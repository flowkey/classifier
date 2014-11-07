NodeManager = function(k) {
    this.nodes = [];
    this.k = k;
    this.r = 1;
    this.featureSpecList = [];
    this.classes = [];
    this.toDraw = [];

};

_.extend(NodeManager.prototype, {

    add: function(node) {
        this.nodes.push(node);
    },

    calculateRanges: function() {

        // for (var j in this.featureSpecList) {
        for (var j = this.featureSpecList.length - 1; j >= 0; j--) {

            var featSpec = this.featureSpecList[j];

            for (var i in this.nodes) {

                if (this.nodes[i][featSpec.name] < featSpec.min) {
                    featSpec.min = this.nodes[i][featSpec.name];
                }

                if (this.nodes[i][featSpec.name] > featSpec.max) {
                    featSpec.max = this.nodes[i][featSpec.name];
                }

            }
        }
    },

    createRandomNode: function(classType) {

        var randomNode = new Node();

        for (var i = this.featureSpecList.length - 1; i >= 0; i--) {
            randomNode[this.featureSpecList[i].name] = Math.floor(Math.random() * this.featureSpecList[i].max) + this.featureSpecList[i].min;
        };

        if (classType) {
            randomNode.classType = classType;
        } else {
            randomNode.classType = false;
        }

        return randomNode;
    },

    addNeighbors: function(node, prototypes) {

        var nodeList;
        if (prototypes) { // for cnn reduction
            nodeList = prototypes;
        } else {
            nodeList = this.nodes;
        }

        /* Clone nodes */
        node.neighbors = [];
        for (var j in nodeList) {
            if (!nodeList[j].classType)
                continue; //immediately start next cycle
            node.neighbors.push(new Node(nodeList[j]));
        }

        /* Measure distances */
        node.measureDistances(this.featureSpecList);

        /* Sort by distance */
        node.sortByDistance();

    },


    determineSingleUnkown: function(node) {

        /* Add neighbors */
        this.addNeighbors(node);

        /* Guess classType */
        node.guessClass(this.k);

        // console.log("determineSingleUnknown: ", node.guess.classType);
    },


    determineAllUnknown: function() {

        this.calculateRanges();

        /*
         * Loop through our nodes and look for unknown classes.
         */
        for (var i in this.nodes) {

            // when type of node is unknown, guess it
            if (!this.nodes[i].classType) {

                /* Add neighbors and sort them */
                this.addNeighbors(this.nodes[i]);

                /* Guess classType */
                this.nodes[i].guessClass(this.k);

                console.log(this.nodes[i].guess.classType);

            }
        }
    },

    removeOutliers: function() {

        console.log("removing outliers, starting with list ", this.nodes);

        var toRemove = [];

        this.calculateRanges();

        for (var i in this.nodes) {

            if (this.nodes[i].classType) {

                var actualClassType = this.nodes[i].classType;

                /* Add neighbors and sort them */
                this.addNeighbors(this.nodes[i]);

                /* Guess type */
                this.nodes[i].guessClass(this.k);
                var guessedType = this.nodes[i].guess.classType;

                /* now that the type was guesssed, we don't need the neighbors anymore, so kill them! */
                this.nodes[i].neighbors = undefined;

                if (this.nodes[i].guess.classType != actualClassType) {
                    toRemove.push(i);
                    console.log("OUTLIER! Kill him!" + " - guess: " + guessedType + "; actual: " + actualClassType);
                }
            }
        }

        var newNodeList = [];

        for (var i = toRemove.length - 1; i >= 0; i--) {
            console.log("tagging node at index " + toRemove[i]);
            this.nodes[toRemove[i]].remove = true;
        };

        for (var i = this.nodes.length - 1; i >= 0; i--) {
            if (!this.nodes[i].remove) {
                newNodeList.push(this.nodes[i]);
            }
        };

        console.log("outliers removed, resulting list is ", newNodeList);

        this.nodes = newNodeList;

        this.draw("canvas", false);

    },


    /* 
     * Condensed Nearest Neighbours Data Reduction:
     * Go through the training set, removing each point in turn,
     * and check whether it is recognised as the correct classType or not
     */
    cnnReduction: function() {

        this.removeOutliers();

        /*
         * Make a new database (will contain prototype nodes)
         */
        var prototypeNodes = [];

        /*
         * we need at least one node in the prototype nodes for starting the algorithm
         * so just put the first one that we have into it
         */
        prototypeNodes.push(this.nodes[0]);

        /*
         * Pick any point from the original set, and see if it is recognised
         * as the correct classType based on the points in the new database,
         * using kNN with k = 1
         *
         * Repeat the scan until no more prototypes are added
         */
        var prototypesAdded = true;

        while (prototypesAdded == true) {

            prototypesAdded = false;

            for (var i = this.nodes.length - 1; i >= 0; i--) {

                // if it's tagged with remove, it's already have been processed
                if (!this.nodes[i].remove) {

                    var actualType = this.nodes[i].classType;

                    /* Add neighbors and sort them */
                    this.addNeighbors(this.nodes[i], prototypeNodes);

                    /* Guess type */
                    this.nodes[i].guessClass(1);
                    var guessedType = this.nodes[i].guess.classType;

                    /* now that the type was guesssed, we don't need the neighbors anymore */
                    this.nodes[i].neighbors = undefined;

                    if (guessedType != actualType) {

                        // this.nodes[i].remove = true;

                        prototypeNodes.push(this.nodes[i]);
                        prototypesAdded = true;

                        console.log("classTypes not equal, node added to prototypes");

                    } //if

                } // if

            } // for

        } // while

        if (prototypeNodes.length > 1) {
            this.nodes = prototypeNodes;
        }
        this.draw("canvas", false);
    },


});



FeatureSpec = function(name) {
    this.name = name;
    this.min = 10000;
    this.max = 0;
};



Node = function(object) {
    for (var key in object) {
        this[key] = object[key];
    }
};

_.extend(Node.prototype, {

    measureDistances: function(featureSpecList) {

        for (var i in this.neighbors) {
            /* Just shortcut syntax */
            var curNeighbor = this.neighbors[i];

            var sum = 0;

            for (var j in featureSpecList) {

                var curFeatSpec = featureSpecList[j];

                var currentRange = curFeatSpec.max - curFeatSpec.min;

                var a = curNeighbor[curFeatSpec.name];
                var b = this[curFeatSpec.name];
                var delta = a - b;

                delta = (delta) / currentRange;

                sum += (delta * delta);

            }

            curNeighbor.distance = Math.sqrt(sum);
        }
    },

    sortByDistance: function() {

        this.neighbors.sort(function(a, b) {
            return a.distance - b.distance;
        });
    },

    // guessClass: function(k) {
    //     var kNeighbors = this.neighbors.slice(0, k);

    //     console.log("neighbors", this.neighbors);

    //     // count
    //     var classCounts = {};
    //     _.each(kNeighbors, function(neighbor, i) {
    //         if (!classCounts[neighbor.classType]) {
    //             classCounts[neighbor.classType] = 0;
    //         }
    //         classCounts[neighbor.classType] += 1;
    //     });

    //     console.log("classCounts: ", classCounts);

    //     //get max
    //     var maxClassType;
    //     var maxCount = 0;
    //     _.each(classCounts, function(count, classType, classCounts) {
    //         console.log("classType:", classType , " count:", count);
    //         if (maxClassType == undefined || count > maxCount) {
    //             maxClassType = classType;
    //             maxCount = count;
    //         }
    //     });

    //     // console.log("maxClassType:", maxClassType , " maxCount:", maxCount);

    //     this.guess = {
    //         classType: maxClassType,
    //         count: maxCount
    //     };

    //     return classCounts;
    // },

    guessClass: function(k) {
        var classes = {};

        for (var i in this.neighbors.slice(0, k)) {
            var neighbor = this.neighbors[i];

            if (!classes[neighbor.classType]) {
                classes[neighbor.classType] = 0;
            }

            classes[neighbor.classType] += 1;
        }

        var guess = {
            classType: false,
            count: 0
        };

        for (var classType in classes) {
            if (classes[classType] > guess.count) {
                guess.classType = classType;
                guess.count = classes[classType];
            }
        }

        this.guess = guess;

        return classes;
    }

});