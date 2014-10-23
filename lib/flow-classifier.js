var debug = Meteor.settings ? Meteor.settings.public.debug : true;
var logMsg = function(msg) {
    if (debug) {
        console.log("[Classifier]" + msg);
    }
}



Classifier = function(parameters) {
    var parameters = parameters || {};

    // creates audioGraph of this 
    initAudioGraph();

    debug = parameters.debug || false;

    this.runModes = {
        "COLLECT": 0,
        "CLASSIFY_ONLINE": 1,
        "CLASSIFY_OFFLINE": 2
    };

    this.canvasId = parameters.canvasId;

    this.runMode = this.runModes.CLASSIFY_ONLINE;

    this.init(parameters);

}


_.extend(Classifier.prototype, {

    init: function(parameters) {

        var self = this;

        self.graph = flow.webaudioManager.getAudioGraph("classifier");
        self.blockLength = self.graph.getNodeSpec("fft-preprocessed").settings.bufferSize;

        self.injections = new FunctionStack();

        /*
         * create features
         */
        self.features = {};
        self.features["zcr"] = new ZeroCrossingRateVar({
            debug: true,
            bufferLength: 15,
        });
        self.features["zcr"].timeDomain = true; //mark as time domain feature

        self.features["cfa"] = new CFA({
            blockLength: self.blockLength,
            debug: true,
            highestPeaksCount: 15,
            binThreshold: 0.001,
            binSpectrumBufferLength: 10,
            emphWindowSize: 21
        });

        var toDraw = ["cfa", "zcr"];

        self.k = parameters.k;

        self.nodeManager = new NodeManager(self.k);

        /*
         * init storage stuff
         */
        if (parameters.specs) {
            self.specs = parameters.specs;

            self.events = {};

            _.each(self.specs, function(typeSpec, typeName, specs) {
                self.events[typeName] = flow.events.create(typeName);
            });
            console.log("classifier events: ", self.events);

            self.storages = {}; // buffering all the feature data of each training sample
            self.sampleIndexes = {};

            _.each(self.specs, function(typeSpec, typeName, specs) {
                self.storages[typeName] = new Array(typeSpec.samples);
                self.sampleIndexes[typeName] = 0;
            });

            //init every storage element with a dummy element
            _.each(self.storages, function(currentStorage, storageName, storages) {
                for (var j = currentStorage.length - 1; j >= 0; j--) {
                    //create storage dummy element for initing storage
                    var dummyElement = {};
                    _.each(self.features, function(currentFeature, featureName, list) {
                        var arrayName = featureName + "Array";
                        dummyElement[arrayName] = [];
                    });
                    currentStorage[j] = dummyElement;
                };
            });

            self.currentType = false;

        }


        /*
         *  init k nearest neighbor stuff
         */

        _.each(self.features, function(currentFeature, featureName, list) {
            self.nodeManager.featureSpecList.push(new FeatureSpec(featureName));
        });

        self.nodeManager.toDraw = toDraw;

        self.nodeManager.types = [];
        _.each(self.specs, function(typeSpec, typeName, specs) {
            self.nodeManager.types.push(typeName);
        });

        self.boundRun = flow.bind(self.run, self);

        //bind compute-methods of each feature to the classifier
        self.boundFeatureInjections = [];
        self.boundTimeDomainInjections = [];

        _.each(self.features, function(currentFeature, featureName, list) {

            //construct a function that sets result of compute as property of feature
            var featureInject = function(block) {
                currentFeature.currentValue = currentFeature.compute(block);
            }

            //bind compute function to classifier
            var boundInject = flow.bind(featureInject, self);

            //put bounded compute function to right array
            if (currentFeature.timeDomain == true) {
                logMsg("time domain feature: ", currentFeature);
                self.boundTimeDomainInjections.push(boundInject);
            } else {
                logMsg("frequency domain feature: ", currentFeature);
                self.boundFeatureInjections.push(boundInject);
            }
        });

    },

    run: function() {
        var self = this

        if (self.runMode == self.runModes.COLLECT) {

            this.collectData();

        } else if (self.runMode == self.runModes.CLASSIFY_ONLINE) {

            this.classifyOnline();

        } else if (self.runMode == self.runModes.CLASSIFY_OFFLINE) {

            this.classifyOffline();

        } else {
            console.warn("No appropriate runMode specified! classifier.runMode: ", self.runMode);
        }

    },

    classifyOnline: function() {

        var newNode = new Node({});

        _.each(this.features, function(currentFeature, featureName, list) {
            newNode[featureName] = currentFeature.currentValue;
            logMsg(featureName + " = " + currentFeature.currentValue);
        });
        newNode.type = false;

        // this.nodeManager.add(newNode);
        this.nodeManager.determineSingleUnkown(newNode);
        // if (this.canvasId){
             // this.nodeManager.draw(this.canvasId, false);
        // }

        this.lastSignalType =  this.currentSignalType;
        this.currentSignalType = newNode.guess.type;

        // =?'* ArGhARhg *%() ToDo: remove hard code!!!!
        // if (this.currentSignalType == "music"){
        //     flow.events.dispatchEvent(this.events[this.currentSignalType]);
        // }

        if (this.currentSignalType != this.lastSignalType){
            flow.events.dispatchEvent(this.events[this.currentSignalType]);
            console.log("[classifier] dispatching signal type ", this.currentSignalType);
        }
       
        this.injections.runAll(newNode.guess.type);

        return newNode;
    },


    classifyOffline: function() {

        try {

            this.createNodesFromStorage(this.storages["unknown"], false);

            this.nodeManager.determineAllUnknown();

            if (this.canvasId){
                this.nodeManager.draw(this.canvasId, false);
            }

        } catch (e) {

            console.error("error occured during classfication from storage data: ", e);

        }

    },


    collectData: function() {
        var self = this;

        // current data type is required
        if (self.currentType) {
            var currentStorage = self.storages[self.currentType];
            var index = self.sampleIndexes[self.currentType];

            _.each(self.features, function(currentFeature, featureName, list) {
                currentStorage[index][featureName + "Array"].push(currentFeature.currentValue);
                // console.log(featureName + " = " + currentFeature.currentValue);
            });

        } else {
            console.error("I don't know to which type this freaking data belongs, dude!");
        }
    },

    learn: function(resetNodeList, nodeFeatureData) {
        var self = this;

        if (resetNodeList) {
            self.nodeManager.nodes = [];
        }

        // if nodeFeatureData is passed as parameter, learn with this
        if (nodeFeatureData) {
            logMsg("Creating nodes with received featureData...");

            _.each(nodeFeatureData, function(curData, i, featureData) {
                self.nodeManager.add(new Node(curData));
            });

        // if no featureData is passed, create nodes from raw data in storage and learn with them
        } else {
            logMsg("Creating nodes from collected data in storage...");

            _.each(this.storages, function(currentStorage, storageName, storages) {
                if (storageName != "unknown") {
                    self.createNodesFromStorage(currentStorage, storageName);
                }
            });
        }

        self.nodeManager.calculateRanges();
        if (self.canvasId){
            self.nodeManager.draw(self.canvasId, false);
        }

    },

    createNodesFromStorage: function(storage, type) {
        var self = this;

        /*
         *  combine featureArrays of each sample to a single value (e.g. mean, variance, ...)
         */
        for (var i = storage.length - 1; i >= 0; i--) {
            var newNode = new Node({});
            _.each(self.features, function(currentFeature, featureName, list) {
                newNode[featureName] = mean(storage[i][featureName + "Array"]);
            });
            newNode.type = type;

            this.nodeManager.add(newNode);
        };

        /*
         *  don't combine featureArrays, just create a feature node for each signalblock
         */
        // for (var i = storage.length - 1; i >= 0; i--) {
        //     var currentStorage = storage[i];
        //     for (var j = currentStorage["cfaArray"].length - 1; j >= 0; j--) {
        //         var newNode = new Node({});
        //         _.each(self.features, function(currentFeature, featureName, list) {
        //             newNode[featureName] = currentStorage[featureName + "Array"][j];
        //         });
        //         newNode.type = type;

        //         this.nodeManager.add(newNode);
        //     };
        // };
    },

    inject: function(fct) {
        this.injections.add(fct);
    }
});