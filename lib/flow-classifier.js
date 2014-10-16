var debug;
var logMsg = function(msg) {
    if (debug) {
        console.log(msg);
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

    this.runMode = this.runModes.CLASSIFY_ONLINE;

    this.init(parameters);

}


_.extend(Classifier.prototype, {

    init: function(parameters) {

        var self = this;

        self.graph = flow.webaudioManager.getAudioGraph("classifier");
        self.blockLength = self.graph.getNodeSpec("fft").settings.bufferSize;

        self.injections = new FunctionStack();

        /*
         * create features
         */
        self.features = {};
        self.features["zcr"] = new ZeroCrossingRateVar({
            debug: true,
            bufferLength: 25,
        });
        self.features["zcr"].timeDomain = true; //mark as time domain feature

        self.features["cfa"] = new CFA({
            blockLength: self.blockLength,
            debug: true,
            highestPeaksCount: 10,
            binThreshold: 0.001,
            binSpectrumBufferLength: 25,
            emphWindowSize: 21
        });

        var toDraw = ["cfa", "zcr"];

        self.nodeManager = new NodeManager(self.k);

        /*
         * init storage stuff
         */
        if (parameters.specs) {
            self.specs = parameters.specs;

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
        self.k = parameters.k;

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
                console.log("time domain feature: ", currentFeature);
                self.boundTimeDomainInjections.push(boundInject);
            } else {
                console.log("frequency domain feature: ", currentFeature);
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
            console.warn("No classifier appropriate runMode specified! classifier.runMode: ", self.runMode);
        }

    },

    classifyOnline: function() {

        var newNode = new Node({});

        _.each(this.features, function(currentFeature, featureName, list) {
            newNode[featureName] = currentFeature.currentValue;
            console.log(featureName + " = " + currentFeature.currentValue);
        });
        newNode.type = false;

        // this.nodeManager.add(newNode);
        this.nodeManager.determineSingleUnkown(newNode);
        // this.nodeManager.draw("canvas", false);

        // console.log(newNode);
        this.injections.runAll(newNode.guess.type);

        return newNode;
    },


    classifyOffline: function() {

        try {

            this.createNodesFromStorage(this.storages["unknown"], false);

            this.nodeManager.determineAllUnknown();

            this.nodeManager.draw("canvas", false);

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

        if (nodeFeatureData) {
            console.log("Creating nodes with received featureData...");

            _.each(nodeFeatureData, function(curData, i, featureData) {
                classifier.nodeManager.add(new Node(curData));
            });

        } else {
            console.log("Creating nodes from collected data in storage...");

            _.each(this.storages, function(currentStorage, storageName, storages) {
                if (storageName != "unknown") {
                    self.createNodesFromStorage(currentStorage, storageName);
                }
            });
        }

        self.nodeManager.calculateRanges();
        self.nodeManager.draw("canvas", false);

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