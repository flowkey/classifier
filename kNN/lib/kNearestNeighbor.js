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

    getNeighbors: function(node) {

        var neighbors = [];

        for (var j in this.nodes) {
            if (!this.nodes[j].type)
                continue; //immediately start next cycle
            neighbors.push(new Node(this.nodes[j]));
        }

        return neighbors;
    },


    determineSingleUnkown: function(node) {

        node.neighbors = this.getNeighbors(node);

        // node.neighbors = [];
        // for (var j in this.nodes) {
        //     if (!this.nodes[j].type)
        //         continue; //immediately start next cycle
        //     node.neighbors.push(new Node(this.nodes[j]));
        // }

        /* Measure distances */
        node.measureDistances(this.featureSpecList);

        /* Sort by distance */
        node.sortByDistance();

        /* Guess type */
        node.guessType(this.k);

        // console.log(node.guess.type);
    },

    determineUnknown: function() {

        this.calculateRanges();

        /*
         * Loop through our nodes and look for unknown types.
         */
        for (var i in this.nodes) {

            if (!this.nodes[i].type) {

                // console.log("determining unknown node: ", this.nodes[i]);
                /*
                 * If node doesn't have a type
                 * clone the nodes list and then measure distances.
                 */

                /* Clone nodes */
                this.nodes[i].neighbors = [];
                for (var j in this.nodes) {
                    if (!this.nodes[j].type)
                        continue; //immediately start next cycle
                    this.nodes[i].neighbors.push(new Node(this.nodes[j]));
                }


                /* Measure distances */
                this.nodes[i].measureDistances(this.featureSpecList);

                /* Sort by distance */
                this.nodes[i].sortByDistance();

                /* Guess type */
                this.nodes[i].guessType(this.k);

                console.log(this.nodes[i].guess.type);

            }
        }
    },

    removeOutliers: function() {

        console.log("removing outliers, starting with list ", this.nodes);

        this.calculateRanges();

        var toRemove = [];

        for (var i in this.nodes) {

            if (this.nodes[i].type) {

                var actualType = this.nodes[i].type;

                /* Clone nodes */
                this.nodes[i].neighbors = [];
                for (var j in this.nodes) {
                    if (!this.nodes[j].type)
                        continue; //immediately start next cycle
                    this.nodes[i].neighbors.push(new Node(this.nodes[j]));
                }

                /* Measure distances */
                this.nodes[i].measureDistances(this.featureSpecList);

                /* Sort by distance */
                this.nodes[i].sortByDistance();

                /* Guess type */
                this.nodes[i].guessType(this.k);

                var guessedType = this.nodes[i].guess.type;

                console.log("guess: " + guessedType + "; actual: " + actualType);

                if (this.nodes[i].guess.type != actualType) {
                    toRemove.push(i);
                    console.log("OUTLIER! Kill him!");
                }
            }
        }

        var newNodeList = [];

        for (var i = toRemove.length - 1; i >= 0; i--) {
            console.log("tagging node at index " + toRemove[i]);
            this.nodes[toRemove[i]].remove = true;
        };

        for (var i = this.nodes.length - 1; i >= 0; i--) {
            if (!this.nodes[i].remove){
                newNodeList.push(this.nodes[i]);
            }
        };

        console.log("outliers removed, resulting list is ", newNodeList);

        this.nodes = newNodeList;

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