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
            timeDomain: true
        });
        self.features["cfa"] = new CFA({
            blockLength: self.blockLength,
            debug: true,
            highestPeaksCount: 10,
            binThreshold: 0.001,
            binSpectrumBufferLength: 25,
            emphWindowSize: 21
        });

        var toDraw = ["cfa", "zcr"];

        /*
         *  init k nearest neighbor stuff
         */
        self.k = parameters.k;
        self.nodeManager = new NodeManager(self.k);

        _.each(self.features, function(currentFeature, featureName, list) {
            self.nodeManager.featureSpecList.push(new FeatureSpec(featureName));
        });

        self.nodeManager.toDraw = toDraw;

        self.nodeManager.types = [];
        _.each(self.specs, function(typeSpec, typeName, specs) {
            self.nodeManager.types.push(typeName);
        });

        self.boundCollectData = flow.bind(self.collectData, self);
        self.boundRealTimeClassify = flow.bind(self.realTimeClassify, self);

        //bind compute-methods of each feature to the classifier
        self.boundFeatureInjections = [];
        self.boundTimeDomainInjections = [];

        _.each(self.features, function(currentFeature, featureName, list) {
            var featureInject = function(block) {
                currentFeature.currentValue = currentFeature.compute(block);
            }
            var boundInject = flow.bind(featureInject, self);
            if (currentFeature.timeDomain == true) {
                self.boundTimeDomainInjections.push(boundInject);
            } else {
                self.boundFeatureInjections.push(boundInject);
            }
        });

        console.log("boundFeatureInjections", self.boundFeatureInjections);
        console.log("boundTimeDomainInjections", self.boundTimeDomainInjections);

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

        }else{

            console.warn("no training specs for classifier, using data set in stock");
            self.nodeManager.nodes = defaultNodes;

        }
       
    },

    collectData: function() {
        var self = this;

        if (self.currentType) {
            var currentStorage = self.storages[self.currentType];
            var index = self.sampleIndexes[self.currentType];

            _.each(self.features, function(currentFeature, featureName, list) {
                currentStorage[index][featureName + "Array"].push(currentFeature.currentValue);
            });

        } else {
            console.error("I don't know to which type this freaking data belongs, dude!");
        }
    },

    train: function(resetNodeList) {
        var self = this;

        if (resetNodeList) {
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

        try {

            this.createNodesFromStorage(this.storages["unknown"], false);

            this.nodeManager.determineAllUnknown();

            this.nodeManager.draw("canvas", false);

        } catch (e) {

            console.error("error occured during classfication from storage data: ", e);

        }

    },


    realTimeClassify: function() {

        var newNode = new Node({});

        _.each(this.features, function(currentFeature, featureName, list) {
            console.log(featureName, currentFeature.currentValue);
            newNode[featureName] = currentFeature.currentValue;
        });
        newNode.type = false;

        console.log(newNode);

        // this.nodeManager.add(newNode);
        this.nodeManager.determineSingleUnkown(newNode);
        // this.nodeManager.draw("canvas", false);

        console.log(newNode.guess.type);

        this.injections.runAll(newNode.guess.type);

        return newNode;
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


defaultNodes = [{
    "zcr": 0.00030608466911401575,
    "cfa": 1.9897117196461191,
    "type": "music"
}, {
    "zcr": 0.0005037318260099146,
    "cfa": 2.7983610125887863,
    "type": "music"
}, {
    "zcr": 0.0002916786595326073,
    "cfa": 4.05441862682617,
    "type": "music"
}, {
    "zcr": 0.00023970524288461178,
    "cfa": 3.714393932456998,
    "type": "music"
}, {
    "zcr": 0.00016938917117903906,
    "cfa": 3.6396050271088236,
    "type": "music"
}, {
    "zcr": 0.0001712177095480016,
    "cfa": 3.916847563461817,
    "type": "music"
}, {
    "zcr": 0.00016979671635790697,
    "cfa": 3.775100798517928,
    "type": "music"
}, {
    "zcr": 0.0009573803394897648,
    "cfa": 2.262179609130732,
    "type": "music"
}, {
    "zcr": 0.0003913297256916357,
    "cfa": 3.201839428659681,
    "type": "music"
}, {
    "zcr": 0.0004150958795454625,
    "cfa": 3.1347476330366413,
    "type": "music"
}, {
    "zcr": 0.00044722810943122426,
    "cfa": 0.8222852520500296,
    "type": "music"
}, {
    "zcr": 0.0001811710419168264,
    "cfa": 2.909503632929477,
    "type": "music"
}, {
    "zcr": 0.00029026564624811286,
    "cfa": 3.727596917413464,
    "type": "music"
}, {
    "zcr": 0.00019951017985691917,
    "cfa": 4.062945729800204,
    "type": "music"
}, {
    "zcr": 0.0002865718049451012,
    "cfa": 3.400646765677801,
    "type": "music"
}, {
    "zcr": 0.0001675378330797902,
    "cfa": 2.4561291056591794,
    "type": "music"
}, {
    "zcr": 0.00024930137084268957,
    "cfa": 3.1856589255811163,
    "type": "music"
}, {
    "zcr": 0.00038406373664601526,
    "cfa": 3.9260465361813237,
    "type": "music"
}, {
    "zcr": 0.0003246242697963333,
    "cfa": 1.5823080435261552,
    "type": "music"
}, {
    "zcr": 0.0024093710648250494,
    "cfa": 0.7191241846214833,
    "type": "music"
}, {
    "zcr": 0.00095177787576516,
    "cfa": 1.8164492486583597,
    "type": "music"
}, {
    "zcr": 0.0015238647181565917,
    "cfa": 1.2252014222265986,
    "type": "music"
}, {
    "zcr": 0.0007328853601952154,
    "cfa": 1.4626493301478127,
    "type": "music"
}, {
    "zcr": 0.0003233395049946995,
    "cfa": 1.4867271054042412,
    "type": "music"
}, {
    "zcr": 0.00038182109817572755,
    "cfa": 1.9552959084718544,
    "type": "music"
}, {
    "zcr": 0.0002582260402666393,
    "cfa": 1.7517853125005403,
    "type": "music"
}, {
    "zcr": 0.000968809274289038,
    "cfa": 1.9872868414535076,
    "type": "music"
}, {
    "zcr": 0.00026752125712531047,
    "cfa": 2.2963636474063,
    "type": "music"
}, {
    "zcr": 0.0006069536149284082,
    "cfa": 2.341395359572976,
    "type": "music"
}, {
    "zcr": 0.0005279288947661528,
    "cfa": 2.631395358260173,
    "type": "music"
}, {
    "zcr": 0.0009073041518754156,
    "cfa": 2.1417516669323042,
    "type": "music"
}, {
    "zcr": 0.0009958557393378086,
    "cfa": 2.3941085674157434,
    "type": "music"
}, {
    "zcr": 0.0008426794563653682,
    "cfa": 3.8832558474048624,
    "type": "music"
}, {
    "zcr": 0.0004011202148732082,
    "cfa": 3.1776744296211143,
    "type": "music"
}, {
    "zcr": 0.0007456366793510944,
    "cfa": 2.7646511907494347,
    "type": "music"
}, {
    "zcr": 0.0011027645490718164,
    "cfa": 3.661818203431639,
    "type": "music"
}, {
    "zcr": 0.0007734705900846287,
    "cfa": 1.9757364561218158,
    "type": "music"
}, {
    "zcr": 0.000917717358690433,
    "cfa": 2.470387614021699,
    "type": "music"
}, {
    "zcr": 0.0020089001953384708,
    "cfa": 2.4303876190453537,
    "type": "music"
}, {
    "zcr": 0.0028280996344651047,
    "cfa": 1.2612981993541093,
    "type": "music"
}, {
    "zcr": 0.01417744706689832,
    "cfa": 0.5962034382934022,
    "type": "music"
}, {
    "zcr": 0.00890466323061669,
    "cfa": 1.7532403180187985,
    "type": "speech"
}, {
    "zcr": 0.0015504224139873493,
    "cfa": 1.537364362053169,
    "type": "speech"
}, {
    "zcr": 0.014068861134769293,
    "cfa": 1.4474418775142397,
    "type": "speech"
}, {
    "zcr": 0.003982765496037886,
    "cfa": 1.2716450293979797,
    "type": "speech"
}, {
    "zcr": 0.014388219806856,
    "cfa": 0.889820989512142,
    "type": "speech"
}, {
    "zcr": 0.015660690423926257,
    "cfa": 1.1533333375587944,
    "type": "speech"
}, {
    "zcr": 0.008300002413565195,
    "cfa": 1.3947286796142428,
    "type": "speech"
}, {
    "zcr": 0.016686673726864398,
    "cfa": 1.4525581419814464,
    "type": "speech"
}, {
    "zcr": 0.0038780936183643987,
    "cfa": 1.7975193882981937,
    "type": "speech"
}, {
    "zcr": 0.006562712555161321,
    "cfa": 1.125727384616124,
    "type": "speech"
}, {
    "zcr": 0.010577460061952926,
    "cfa": 1.0686280684365297,
    "type": "speech"
}, {
    "zcr": 0.011112259137265167,
    "cfa": 1.0277824807337106,
    "type": "speech"
}, {
    "zcr": 0.013969910590323313,
    "cfa": 0.4701956301224072,
    "type": "speech"
}, {
    "zcr": 0.018552574868836977,
    "cfa": 0.15712037892946795,
    "type": "speech"
}, {
    "zcr": 0.01584885887795224,
    "cfa": 0.8909471811835985,
    "type": "speech"
}, {
    "zcr": 0.004284102380407621,
    "cfa": 1.99906978842824,
    "type": "speech"
}, {
    "zcr": 0.0023782484160644398,
    "cfa": 1.968403125150028,
    "type": "speech"
}, {
    "zcr": 0.0011566682219763924,
    "cfa": 1.8421705547691307,
    "type": "speech"
}, {
    "zcr": 0.0041517003566821885,
    "cfa": 1.7675193897051409,
    "type": "speech"
}, {
    "zcr": 0.0010430187885727656,
    "cfa": 1.7753485005348921,
    "type": "speech"
}, {
    "zcr": 0.01019335984573845,
    "cfa": 1.5866666681949022,
    "type": "speech"
}, {
    "zcr": 0.0026933446785741225,
    "cfa": 0.967286829165248,
    "type": "speech"
}, {
    "zcr": 0.00821042255826689,
    "cfa": 1.241395347686701,
    "type": "speech"
}, {
    "zcr": 0.007301394746781833,
    "cfa": 1.6368682154216043,
    "type": "speech"
}, {
    "zcr": 0.0017312385249892617,
    "cfa": 2.0641860627504283,
    "type": "speech"
}, {
    "zcr": 0.0038382599245845466,
    "cfa": 1.0599069734703201,
    "type": "speech"
}, {
    "zcr": 0.001329570261599296,
    "cfa": 1.3879069698064825,
    "type": "speech"
}, {
    "zcr": 0.008486713822327583,
    "cfa": 1.139393940963077,
    "type": "speech"
}, {
    "zcr": 0.002136256279655791,
    "cfa": 0.8121239001985084,
    "type": "speech"
}, {
    "zcr": 0.002372606622805091,
    "cfa": 0,
    "type": "silence"
}, {
    "zcr": 0.0027072291443252313,
    "cfa": 0,
    "type": "silence"
}, {
    "zcr": 0.003107752692847726,
    "cfa": 0.00002279565919686921,
    "type": "silence"
}, {
    "zcr": 0.0009906012564966983,
    "cfa": 0,
    "type": "silence"
}, {
    "zcr": 0.0029801983451848875,
    "cfa": 0,
    "type": "silence"
}, {
    "zcr": 0.001481842030044587,
    "cfa": 0.06701664285126013,
    "type": "silence"
}];