var debug = Meteor.settings ? Meteor.settings.public.debug : true;
var logMsg = function(msg) {
    if (debug) {
        console.log("[Classifier]" + msg);
    }
}



Classifier = function(parameters) {
    var parameters = parameters || {};
    var self = this;

    self.webaudioManager = parameters.webaudioManager;
    self.graph = parameters.audioGraph;

    if (self.webaudioManager) {
        self.initAudioGraph();
        self.graph = self.webaudioManager.getAudioGraph("classifier");
    }

    try {
        self.blockLength = self.graph.getNodeSpec("fft-preprocessed").settings.bufferSize;
        self.sampleRate = self.graph.audioContext.sampleRate / self.graph.getNodeSpec("downsampleAndOverlap").settings.downsampleFactor;
    } catch (e) {
        console.error(e);
    }

    logMsg("classifier blockLength=" + self.blockLength);
    logMsg("classifier sampleRate=" + self.sampleRate);

    debug = parameters.debug || false;

    this.runModes = {
        "COLLECT": 0,
        "CLASSIFY_ONLINE": 1,
        "CLASSIFY_OFFLINE": 2
    };

    this.init(parameters);
}


_.extend(Classifier.prototype, {
    init: function(parameters) {

        var self = this;

        self.k = parameters.k;

        self.canvasId = parameters.canvasId;

        self.runMode = self.runModes.CLASSIFY_ONLINE;

        self.injections = new FunctionStack();

        // create, init, bind and inject all that stuff, bro!
        self.createFeatures(parameters.featureSpecs);
        self.createStoreage(parameters.classSpecs);
        self.createEvents(parameters.classSpecs);
        self.createNodeManager(parameters.classSpecs, parameters.toDraw);
        self.bindAndInject();


    },

    /*
     * create features with featureSpec object, which contains the constructor of the feature and further parameters;
     * The classifier graph specific sampleRate and blockLength gets added to the feature
     * (which is the reason this whole object.create thing is done)
     */
    createFeatures: function(featureSpecs) {
        var self = this;

        self.features = {};

        _.each(featureSpecs, function(featureSpec, featureName, specs) {
            // create the properties with classifier.sampleRate and classifier.blockLength...
            var properties = {};
            properties["blockLength"] = self.blockLength
            properties["sampleRate"] = self.sampleRate;
            // ...plus each of the params which were passed
            _.each(featureSpec.params, function(value, paramName, params) {
                properties[paramName] = value;
            });

            // now create the actual feature instance
            self.features[featureName] = new featureSpec.constructor(properties);
            self.features[featureName].timeDomain = properties.timeDomain;
        });

        console.log("Classifier features: ", self.features);
    },


    /*
     * creates an event for each class
     * these events are thrown during the realtime classification
     * other modules can listen and react to them
     */
    createEvents: function(classSpecs) {
        var self = this;

        self.events = {};

        _.each(classSpecs, function(typeSpec, className, classSpecs) {
            self.events[className] = flow.events.create(className);
        });
    },


    /*
     * create and init storages, which are needed when we want to train the classifier with audiosamples;
     * all the raw feature values of each audio samples will be stored here, before we create the actual nodes
     */
    createStoreage: function(classSpecs) {
        var self = this;

        self.storages = {}; // buffering all the feature data of each training sample
        self.sampleIndexes = {};

        _.each(classSpecs, function(typeSpec, className, classSpecs) {
            self.storages[className] = new Array(typeSpec.samples);
            self.sampleIndexes[className] = 0;
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

        self.currentClassType = false;
    },

    /*
     *  create and init the nodeManager and all the k nearest neighbor stuff
     */
    createNodeManager: function(classSpecs, toDraw) {
        var self = this;

        self.nodeManager = new NodeManager(self.k);

        // set feature specifications of NodeManager
        _.each(self.features, function(currentFeature, featureName, list) {
            self.nodeManager.featureSpecList.push(new FeatureSpec(featureName));
        });

        // tell him, which features to draw (in case we have canvas)
        self.nodeManager.toDraw = toDraw;

        // tell the nodeManager, which classes we train / classify
        self.nodeManager.classes = [];
        _.each(classSpecs, function(classSpec, className, classSpecs) {
            self.nodeManager.classes.push(className);
            // console.log(self.nodeManager.classes);
        });
    },

    /*
     * binding the main run function of classifier
     * as well as all the compute-functions for the feature;
     * push the bound compute functions into an array
     */
    bindAndInject: function() {
        var self = this;

        self.boundRun = flow.bind(self.run, self);

        //bind compute-methods of each feature to the classifier
        self.boundFeatureInjections = [];
        self.boundTimeDomainInjections = [];

        _.each(self.features, function(currentFeature, featureName, list) {

            //construct a function that sets result of compute as property of feature
            var featureInject = function(block) {
                currentFeature.currentValue = currentFeature.compute(block);
            };

            //bind compute function to classifier
            var boundInject = flow.bind(featureInject, self);

            //put bounded compute function to right array
            if (currentFeature.timeDomain === true) {
                logMsg("time domain feature: ", currentFeature);
                self.boundTimeDomainInjections.push(boundInject);
            } else {
                logMsg("frequency domain feature: ", currentFeature);
                self.boundFeatureInjections.push(boundInject);
            }
        });
    },

    /*
     * the main run function, which is binded and injected to audioGraph
     * ------------------------------------------------------------------
     */
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
        newNode.classType = false;

        this.nodeManager.determineSingleUnkown(newNode);

        this.lastSignalType = this.currentSignalType;
        this.currentSignalType = newNode.guess.classType;

        if (this.currentSignalType != this.lastSignalType) {
            flow.events.dispatchEvent(this.events[this.currentSignalType]);
            console.log("[classifier] dispatching signal classType ", this.currentSignalType);
        }

        this.injections.runAll(newNode.guess.classType);

        return newNode;
    },


    classifyOffline: function() {

        try {

            this.createNodesFromStorage(this.storages["unknown"], false);

            this.nodeManager.determineAllUnknown();

            if (this.canvasId) {
                this.nodeManager.draw(this.canvasId, false);
            }

        } catch (e) {

            console.error("error occured during classfication from storage data: ", e);

        }

    },

    collectData: function() {
        var self = this;

        // current classType is required
        if (self.currentClassType) {
            var currentStorage = self.storages[self.currentClassType];
            var index = self.sampleIndexes[self.currentClassType];

            _.each(self.features, function(currentFeature, featureName, list) {
                currentStorage[index][featureName + "Array"].push(currentFeature.currentValue);
                console.log(featureName + " = " + currentFeature.currentValue);
            });

        } else {
            console.error("I don't know to which class this freaking data belongs, dude!");
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
        if (self.canvasId) {
            self.nodeManager.draw(self.canvasId, false);
        }

    },

    createNodesFromStorage: function(storage, classType) {
        var self = this;

        /*
         *  combine featureArrays of each sample to a single value (e.g. mean, variance, ...)
         */
        for (var i = storage.length - 1; i >= 0; i--) {
            var newNode = new Node({});
            _.each(self.features, function(currentFeature, featureName, list) {
                newNode[featureName] = mean(storage[i][featureName + "Array"]);
            });
            newNode.classType = classType;

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
        //         newNode.classType = classType;

        //         this.nodeManager.add(newNode);
        //     };
        // };
    },

    inject: function(fct) {
        // console.log("----- INJECT -----", fct);
        this.injections.add(fct);
    }
});