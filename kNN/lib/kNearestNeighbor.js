NodeManager = function(k) {
    this.nodes = [];
    this.k = k;
    this.r = 1;
    this.featureSpecList = [];
    this.types = [];
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

    createRandomNode: function(type) {

        var randomNode = new Node();

        for (var i = this.featureSpecList.length - 1; i >= 0; i--) {
            randomNode[this.featureSpecList[i].name] = Math.floor(Math.random() * this.featureSpecList[i].max) + this.featureSpecList[i].min;
        };

        if (type) {
            randomNode.type = type;
        } else {
            randomNode.type = false;
        }

        return randomNode;
    },

    addNeighbors: function(node) {

        /* Clone nodes */
        node.neighbors = [];
        for (var j in this.nodes) {
            if (!this.nodes[j].type)
                continue; //immediately start next cycle
            node.neighbors.push(new Node(this.nodes[j]));
        }

        /* Measure distances */
        node.measureDistances(this.featureSpecList);

        /* Sort by distance */
        node.sortByDistance();

    },


    determineSingleUnkown: function(node) {

        /* Add neighbors and sort them */
        this.addNeighbors(node);

        /* Guess type */
        node.guessType(this.k);

        // console.log(node.guess.type);
    },


    determineAllUnknown: function() {

        this.calculateRanges();

        /*
         * Loop through our nodes and look for unknown types.
         */
        for (var i in this.nodes) {

            // when type of node is unknown, guess it
            if (!this.nodes[i].type) {

                /* Add neighbors and sort them */
                this.addNeighbors(this.nodes[i]);

                /* Guess type */
                this.nodes[i].guessType(this.k);

                console.log(this.nodes[i].guess.type);

            }
        }
    },

    removeOutliers: function() {

        console.log("removing outliers, starting with list ", this.nodes);

        var toRemove = [];

        this.calculateRanges();

        for (var i in this.nodes) {

            if (this.nodes[i].type) {

                var actualType = this.nodes[i].type;

                /* Add neighbors and sort them */
                this.addNeighbors(this.nodes[i]);

                /* Guess type */
                this.nodes[i].guessType(this.k);
                var guessedType = this.nodes[i].guess.type;

                /* now that the type was guesssed, we don't need the neighbors anymore, so kill them! */
                this.nodes[i].neighbors = undefined;

                if (this.nodes[i].guess.type != actualType) {
                    toRemove.push(i);
                    console.log("OUTLIER! Kill him!" + " - guess: " + guessedType + "; actual: " + actualType);
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


    // Condensed Nearest Neighbours Data Reduction
    cnnReduction: function() {

        // Go through the training set, removing each point in turn,
        // and checking whether it is recognised as the correct class or not
        this.removeOutliers();

        // Make a new database (will contain prototype nodes), and add a random point
        var prototypeNodes = [];
        // var randomNode = createRandomNode("music");
        prototypeNodes.push(this.nodes[0]);

        // Pick any point from the original set, and see if it is recognised
        // as the correct class based on the points in the new database,
        // using kNN with k = 1

        // Repeat the scan until no more prototypes are added to U.

        var prototypesAdded = true;

        while (prototypesAdded == true) {

            prototypesAdded = false;

            for (var i = this.nodes.length - 1; i >= 0; i--) {

                if (!this.nodes[i].remove) {

                    var actualType = this.nodes[i].type;

                    /* Add neighbors and sort them */
                    this.addNeighbors(this.nodes[i]);

                    /* Guess type */
                    this.nodes[i].guessType(1);
                    var guessedType = this.nodes[i].guess.type;

                    /* now that the type was guesssed, we don't need the neighbors property anymore */
                    this.nodes[i].neighbors = undefined;


                    if (this.nodes[i].guess.type != actualType) {

                        this.nodes[i].remove = true;

                        prototypeNodes.push(this.nodes[i]);
                        prototypesAdded = true;

                        console.log("types not equal, node added to prototypes");

                    } //if

                } // if

            } // for

        } // while


        this.nodes = prototypeNodes;
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

    guessType: function(k) {
        var types = {};

        for (var i in this.neighbors.slice(0, k)) {
            var neighbor = this.neighbors[i];

            if (!types[neighbor.type]) {
                types[neighbor.type] = 0;
            }

            types[neighbor.type] += 1;
        }

        var guess = {
            type: false,
            count: 0
        };
        for (var type in types) {
            if (types[type] > guess.count) {
                guess.type = type;
                guess.count = types[type];
            }
        }

        this.guess = guess;

        return types;
    }

});