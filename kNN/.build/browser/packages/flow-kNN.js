(function () {

//////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                          //
// packages/flow-kNN/lib/kNearestNeighbor.js                                                //
//                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////
                                                                                            //
NodeManager = function(k) {                                                                 // 1
    this.nodes = [];                                                                        // 2
    this.k = k;                                                                             // 3
    this.featureSpecList = [];                                                              // 4
    this.types = [];                                                                        // 5
    this.toDraw = [];                                                                       // 6
                                                                                            // 7
};                                                                                          // 8
                                                                                            // 9
_.extend(NodeManager.prototype, {                                                           // 10
                                                                                            // 11
    add: function(node) {                                                                   // 12
        this.nodes.push(node);                                                              // 13
    },                                                                                      // 14
                                                                                            // 15
    calculateRanges: function() {                                                           // 16
                                                                                            // 17
        // for (var j in this.featureSpecList) {                                            // 18
        for (var j = this.featureSpecList.length - 1; j >= 0; j--) {                        // 19
                                                                                            // 20
            var featSpec = this.featureSpecList[j];                                         // 21
                                                                                            // 22
            for (var i in this.nodes) {                                                     // 23
                                                                                            // 24
                if (this.nodes[i][featSpec.name] < featSpec.min) {                          // 25
                    featSpec.min = this.nodes[i][featSpec.name];                            // 26
                }                                                                           // 27
                                                                                            // 28
                if (this.nodes[i][featSpec.name] > featSpec.max) {                          // 29
                    featSpec.max = this.nodes[i][featSpec.name];                            // 30
                }                                                                           // 31
                                                                                            // 32
            }                                                                               // 33
        }                                                                                   // 34
                                                                                            // 35
                                                                                            // 36
    },                                                                                      // 37
                                                                                            // 38
    determineSingleUnkown: function(node){                                                  // 39
        node.neighbors = [];                                                                // 40
        for (var j in this.nodes) {                                                         // 41
            if (!this.nodes[j].type)                                                        // 42
                continue; //immediately start next cycle                                    // 43
            node.neighbors.push(new Node(this.nodes[j]));                                   // 44
        }                                                                                   // 45
                                                                                            // 46
        /* Measure distances */                                                             // 47
        node.measureDistances(this.featureSpecList);                                        // 48
                                                                                            // 49
        /* Sort by distance */                                                              // 50
        node.sortByDistance();                                                              // 51
                                                                                            // 52
        /* Guess type */                                                                    // 53
        node.guessType(this.k);                                                             // 54
                                                                                            // 55
        console.log(node.guess.type);                                                       // 56
    },                                                                                      // 57
                                                                                            // 58
    determineUnknown: function() {                                                          // 59
                                                                                            // 60
        this.calculateRanges();                                                             // 61
                                                                                            // 62
        /*                                                                                  // 63
         * Loop through our nodes and look for unknown types.                               // 64
         */                                                                                 // 65
        for (var i in this.nodes) {                                                         // 66
                                                                                            // 67
            if (!this.nodes[i].type) {                                                      // 68
                                                                                            // 69
                // console.log("determining unknown node: ", this.nodes[i]);                // 70
                /*                                                                          // 71
                 * If node doesn't have a type                                              // 72
                 * clone the nodes list and then measure distances.                         // 73
                 */                                                                         // 74
                                                                                            // 75
                /* Clone nodes */                                                           // 76
                this.nodes[i].neighbors = [];                                               // 77
                for (var j in this.nodes) {                                                 // 78
                    if (!this.nodes[j].type)                                                // 79
                        continue; //immediately start next cycle                            // 80
                    this.nodes[i].neighbors.push(new Node(this.nodes[j]));                  // 81
                }                                                                           // 82
                                                                                            // 83
                                                                                            // 84
                /* Measure distances */                                                     // 85
                this.nodes[i].measureDistances(this.featureSpecList);                       // 86
                                                                                            // 87
                /* Sort by distance */                                                      // 88
                this.nodes[i].sortByDistance();                                             // 89
                                                                                            // 90
                /* Guess type */                                                            // 91
                this.nodes[i].guessType(this.k);                                            // 92
                                                                                            // 93
                console.log(this.nodes[i].guess.type);                                      // 94
                                                                                            // 95
            }                                                                               // 96
        }                                                                                   // 97
    }                                                                                       // 98
});                                                                                         // 99
                                                                                            // 100
                                                                                            // 101
                                                                                            // 102
FeatureSpec = function(name) {                                                              // 103
    this.name = name;                                                                       // 104
    this.min = 10000;                                                                       // 105
    this.max = 0;                                                                           // 106
};                                                                                          // 107
                                                                                            // 108
                                                                                            // 109
                                                                                            // 110
Node = function(object) {                                                                   // 111
    for (var key in object) {                                                               // 112
        this[key] = object[key];                                                            // 113
    }                                                                                       // 114
};                                                                                          // 115
                                                                                            // 116
_.extend(Node.prototype, {                                                                  // 117
                                                                                            // 118
    measureDistances: function(featureSpecList) {                                           // 119
                                                                                            // 120
        for (var i in this.neighbors) {                                                     // 121
            /* Just shortcut syntax */                                                      // 122
            var curNeighbor = this.neighbors[i];                                            // 123
                                                                                            // 124
            var sum = 0;                                                                    // 125
                                                                                            // 126
            for (var j in featureSpecList) {                                                // 127
                                                                                            // 128
                var curFeatSpec = featureSpecList[j];                                       // 129
                                                                                            // 130
                var currentRange = curFeatSpec.max - curFeatSpec.min;                       // 131
                                                                                            // 132
                var a = curNeighbor[curFeatSpec.name];                                      // 133
                var b = this[curFeatSpec.name];                                             // 134
                var delta = a - b;                                                          // 135
                                                                                            // 136
                delta = (delta) / currentRange;                                             // 137
                                                                                            // 138
                sum += (delta * delta);                                                     // 139
                                                                                            // 140
            }                                                                               // 141
                                                                                            // 142
            curNeighbor.distance = Math.sqrt(sum);                                          // 143
        }                                                                                   // 144
    },                                                                                      // 145
                                                                                            // 146
    sortByDistance: function() {                                                            // 147
                                                                                            // 148
        this.neighbors.sort(function(a, b) {                                                // 149
            return a.distance - b.distance;                                                 // 150
        });                                                                                 // 151
    },                                                                                      // 152
                                                                                            // 153
    guessType: function(k) {                                                                // 154
        var types = {};                                                                     // 155
                                                                                            // 156
        for (var i in this.neighbors.slice(0, k)) {                                         // 157
            var neighbor = this.neighbors[i];                                               // 158
                                                                                            // 159
            if (!types[neighbor.type]) {                                                    // 160
                types[neighbor.type] = 0;                                                   // 161
            }                                                                               // 162
                                                                                            // 163
            types[neighbor.type] += 1;                                                      // 164
        }                                                                                   // 165
                                                                                            // 166
        var guess = {                                                                       // 167
            type: false,                                                                    // 168
            count: 0                                                                        // 169
        };                                                                                  // 170
        for (var type in types) {                                                           // 171
            if (types[type] > guess.count) {                                                // 172
                guess.type = type;                                                          // 173
                guess.count = types[type];                                                  // 174
            }                                                                               // 175
        }                                                                                   // 176
                                                                                            // 177
        this.guess = guess;                                                                 // 178
                                                                                            // 179
        return types;                                                                       // 180
    }                                                                                       // 181
                                                                                            // 182
});                                                                                         // 183
                                                                                            // 184
                                                                                            // 185
//////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                          //
// packages/flow-kNN/lib/draw.js                                                            //
//                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////
                                                                                            //
_.extend(NodeManager.prototype, {                                                           // 1
                                                                                            // 2
                                                                                            // 3
    draw: function(canvas_id, drawRadius) {                                                 // 4
                                                                                            // 5
        /*                                                                                  // 6
         * get features by name from featureSpecList                                        // 7
         */                                                                                 // 8
        var featureX = this.getFeatureByName(this.toDraw[0]);                               // 9
        var featureY = this.getFeatureByName(this.toDraw[1]);                               // 10
                                                                                            // 11
                                                                                            // 12
        var featureX_range = featureX.max - featureX.min;                                   // 13
        var featureY_range = featureY.max - featureY.min;                                   // 14
                                                                                            // 15
        var canvas = document.getElementById(canvas_id);                                    // 16
        var ctx = canvas.getContext("2d");                                                  // 17
        var width = 400;                                                                    // 18
        var height = 400;                                                                   // 19
        ctx.clearRect(0, 0, width, height);                                                 // 20
                                                                                            // 21
        for (var i in this.nodes) {                                                         // 22
            ctx.save();                                                                     // 23
                                                                                            // 24
            //this switch is limited to 3 differenct colors                                 // 25
            //if there are more than 3 types, this code should improved                     // 26
            switch (this.nodes[i].type) {                                                   // 27
                case this.types[0]:                                                         // 28
                    ctx.fillStyle = 'red';                                                  // 29
                    break;                                                                  // 30
                case this.types[1]:                                                         // 31
                    ctx.fillStyle = 'green';                                                // 32
                    break;                                                                  // 33
                case this.types[2]:                                                         // 34
                    ctx.fillStyle = 'blue';                                                 // 35
                    break;                                                                  // 36
                default:                                                                    // 37
                    ctx.fillStyle = '#666666';                                              // 38
            }                                                                               // 39
                                                                                            // 40
            var padding = 40;                                                               // 41
            var x_shift_pct = (width - padding) / width;                                    // 42
            var y_shift_pct = (height - padding) / height;                                  // 43
                                                                                            // 44
            var x = (this.nodes[i][featureX.name] - featureX.min) * (width / featureX_range) * x_shift_pct + (padding / 2);
            var y = (this.nodes[i][featureY.name] - featureY.min) * (height / featureY_range) * y_shift_pct + (padding / 2);
            y = Math.abs(y - height);                                                       // 47
                                                                                            // 48
                                                                                            // 49
            ctx.translate(x, y);                                                            // 50
            ctx.beginPath();                                                                // 51
            ctx.arc(0, 0, 5, 0, Math.PI * 2, true);                                         // 52
            ctx.fill();                                                                     // 53
            ctx.closePath();                                                                // 54
                                                                                            // 55
                                                                                            // 56
            /*                                                                              // 57
             * Is this an unknown node? If so, draw the radius of influence                 // 58
             */                                                                             // 59
            //this switch is limited to 3 differenct colors                                 // 60
            //if there are more than 3 types, this code should improved                     // 61
            if (!this.nodes[i].type && drawRadius) {                                        // 62
                switch (this.nodes[i].guess.type) {                                         // 63
                    case this.types[0]:                                                     // 64
                        ctx.strokeStyle = 'red';                                            // 65
                        break;                                                              // 66
                    case this.types[1]:                                                     // 67
                        ctx.strokeStyle = 'green';                                          // 68
                        break;                                                              // 69
                    case this.types[2]:                                                     // 70
                        ctx.strokeStyle = 'blue';                                           // 71
                        break;                                                              // 72
                    default:                                                                // 73
                        ctx.strokeStyle = '#666666';                                        // 74
                }                                                                           // 75
                                                                                            // 76
                var radius = this.nodes[i].neighbors[this.k - 1].distance * width;          // 77
                radius *= x_shift_pct;                                                      // 78
                ctx.beginPath();                                                            // 79
                ctx.arc(0, 0, radius, 0, Math.PI * 2, true);                                // 80
                ctx.stroke();                                                               // 81
                ctx.closePath();                                                            // 82
                                                                                            // 83
            }                                                                               // 84
                                                                                            // 85
            ctx.restore();                                                                  // 86
                                                                                            // 87
        }                                                                                   // 88
    },                                                                                      // 89
                                                                                            // 90
    getFeatureByName: function(name){                                                       // 91
        var feature;                                                                        // 92
        for (var i = this.featureSpecList.length - 1; i >= 0; i--) {                        // 93
            if (this.featureSpecList[i].name == name){                                      // 94
                feature = this.featureSpecList[i];                                          // 95
            }                                                                               // 96
        };                                                                                  // 97
        if (typeof(feature) == undefined){                                                  // 98
            console.error("no feature found with the name '"+parameters.featureX_name+"'"); // 99
        }                                                                                   // 100
        return feature;                                                                     // 101
    }                                                                                       // 102
});                                                                                         // 103
//////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);
