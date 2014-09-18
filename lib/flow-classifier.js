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
    var self = this;

    self.graph = flow.webaudioManager.getAudioGraph("classifier");
    self.blockLength = self.graph.getNodeSpec("fft-clean").settings.bufferSize;

    self.sampleRate = 44100;
    console.warn("todo: remove hard code");

    // create features
    this.features = {};

    this.injections = new FunctionStack();

    // this.features["flux"] = new SpectralFlux({
    //     debug: true,
    //     blockLength: self.blockLength,
    //     bufferLength: 10
    // });

    // this.features["chroma"] = new ChromaDiff({
    //     blockLength: self.blockLength,
    //     sampleRate: self.sampleRate,
    //     fMax: 4186 * 2,
    //     bufferLength: 10,
    // });

    // this.features["centroid"] = new SpectralCentroidVar({
    //     blockLength: self.blockLength,
    //     sampleRate: self.sampleRate,
    //     bufferLength: 10
    // });

    // this.features["rolloff"] = new SpectralRolloffVar({
    //     blockLength: self.blockLength,
    //     sampleRate: self.sampleRate,
    //     bufferLength: 10
    // });

    // this.features["rms"] = new RMS({
    //     debug: true,
    // });


    this.features["zcr"] = new ZeroCrossingRateVar({
        debug: true,
        bufferLength: 25,
        timeDomain: true
    });

    //brauchbare unterschiede
    this.features["cfa"] = new CFA({
        blockLength: self.blockLength,
        debug: true,
        highestPeaksCount: 10,
        binThreshold: 0.001,
        binSpectrumBufferLength: 25,
        emphWindowSize: 21
    });

    var toDraw = ["cfa", "zcr"];

    self.specs = parameters.specs;

    self.storages = {};
    self.sampleIndexes = {};

    _.each(self.specs, function(typeSpec, typeName, specs) {
        // self.storage.push(new Array(typeSpec.samples));
        self.storages[typeName] = new Array(typeSpec.samples);
        self.sampleIndexes[typeName] = 0;
    });




    //init every storage element with the dummy
    _.each(self.storages, function(currentStorage, storageName, storages) {
        for (var j = currentStorage.length - 1; j >= 0; j--) {
            //create storage dummy element for initing storage
            var storageElement = {};
            _.each(self.features, function(currentFeature, featureName, list) {
                var arrayName = featureName + "Array";
                storageElement[arrayName] = [];
            });
            currentStorage[j] = storageElement;
        };
    });

    self.currentType = false;

    /*
     * k-NearestNeighbor-Stuff
     */
    self.k = 3;
    self.nodeManager = new NodeManager(self.k);

    _.each(self.features, function(currentFeature, featureName, list) {
        self.nodeManager.featureSpecList.push(new FeatureSpec(featureName));
    });

    self.nodeManager.toDraw = toDraw;

    self.nodeManager.types = [];
    _.each(self.specs, function(typeSpec, typeName, specs) {
        self.nodeManager.types.push(typeName);
    });

    console.log("classifier has " + self.nodeManager.types.length + " types: ", self.nodeManager.types);

    self.boundCollectData = flow.bind(self.collectData, self);
    self.boundRealTimeClassify = flow.bind(self.realTimeClassify, self);

    //bind compute-methods of each feature to the classifier
    self.boundFeatureInjections = [];
    self.boundTimeDomainInjections = [];
    _.each(self.features, function(currentFeature, featureName, list) {
        var featureInject = function(spectrum) {
            currentFeature.currentValue = currentFeature.compute(spectrum);
        }
        var boundInject = flow.bind(featureInject, self);
        if (currentFeature.timeDomain == true) {
            self.boundTimeDomainInjections.push(boundInject);
        } else {
            self.boundFeatureInjections.push(boundInject);
        }

    });

    // console.log("boundTimeDomainInjections", this.boundTimeDomainInjections);

}



_.extend(Classifier.prototype, {

    collectData: function() {
        var self = this;

        if (self.currentType) {
            var currentStorage = self.storages[self.currentType];
            var index = self.sampleIndexes[self.currentType];
            // console.log(index);

            _.each(self.features, function(currentFeature, featureName, list) {
                currentStorage[index][featureName + "Array"].push(currentFeature.currentValue);
            });
        } else {
            console.error("I don't know to which type this freaking data belongs, dude!")
        }
    },

    train: function(resetNodeList) {
        var self = this;

        if (resetNodeList){
            self.nodeManager.nodes = [];
        }

        _.each(this.storages, function(currentStorage, storageName, storages) {
            if (storageName != "unknown") {
                self.createNodesFromStorage(currentStorage, storageName);
            }
        });

        self.nodeManager.calculateRanges();
        self.nodeManager.draw("canvas", false);

        // console.log(self.nodeManager);

    },

    classify: function() {

        this.createNodesFromStorage(this.storages["unknown"], false);
        this.nodeManager.determineUnknown();

        this.nodeManager.draw("canvas", false);

        // console.log(this.nodeManager);

    },


    realTimeClassify: function(spectrum) {

        var newNode = new Node({});

        _.each(this.features, function(currentFeature, featureName, list) {
            newNode[featureName] = currentFeature.currentValue;
        });
        newNode.type = false;

        // this.nodeManager.add(newNode);
        this.nodeManager.determineSingleUnkown(newNode);
        // this.nodeManager.draw("canvas", false);

        this.injections.runAll(newNode.guess.type);
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

            // console.log("new node from storage", newNode);

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