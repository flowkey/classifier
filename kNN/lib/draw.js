_.extend(NodeManager.prototype, {


    draw: function(canvas_id, drawRadius) {

        /*
         * get features by name from featureSpecList
         */
        var featureX = this.getFeatureByName(this.toDraw[0]);
        var featureY = this.getFeatureByName(this.toDraw[1]);


        var featureX_range = featureX.max - featureX.min;
        var featureY_range = featureY.max - featureY.min;

        var canvas = document.getElementById(canvas_id);
        var ctx = canvas.getContext("2d");
        var width = 400;
        var height = 400;
        ctx.clearRect(0, 0, width, height);

        for (var i in this.nodes) {
            ctx.save();

            //this switch is limited to 3 differenct colors
            //if there are more than 3 types, this code should improved
            switch (this.nodes[i].type) {
                case this.types[0]:
                    ctx.fillStyle = 'red';
                    break;
                case this.types[1]:
                    ctx.fillStyle = 'green';
                    break;
                case this.types[2]:
                    ctx.fillStyle = 'blue';
                    break;
                default:
                    ctx.fillStyle = '#666666';
            }

            var padding = 40;
            var x_shift_pct = (width - padding) / width;
            var y_shift_pct = (height - padding) / height;

            var x = (this.nodes[i][featureX.name] - featureX.min) * (width / featureX_range) * x_shift_pct + (padding / 2);
            var y = (this.nodes[i][featureY.name] - featureY.min) * (height / featureY_range) * y_shift_pct + (padding / 2);
            y = Math.abs(y - height);


            ctx.translate(x, y);
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2, true);
            ctx.fill();
            ctx.closePath();


            /* 
             * Is this an unknown node? If so, draw the radius of influence
             */
            //this switch is limited to 3 differenct colors
            //if there are more than 3 types, this code should improved
            if (!this.nodes[i].type && drawRadius) {
                switch (this.nodes[i].guess.type) {
                    case this.types[0]:
                        ctx.strokeStyle = 'red';
                        break;
                    case this.types[1]:
                        ctx.strokeStyle = 'green';
                        break;
                    case this.types[2]:
                        ctx.strokeStyle = 'blue';
                        break;
                    default:
                        ctx.strokeStyle = '#666666';
                }

                var radius = this.nodes[i].neighbors[this.k - 1].distance * width;
                radius *= x_shift_pct;
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, Math.PI * 2, true);
                ctx.stroke();
                ctx.closePath();

            }

            ctx.restore();

        }
    },

    getFeatureByName: function(name){
        var feature;
        for (var i = this.featureSpecList.length - 1; i >= 0; i--) {
            if (this.featureSpecList[i].name == name){
                feature = this.featureSpecList[i];
            }
        };
        if (typeof(feature) == undefined){
            console.error("no feature found with the name '"+parameters.featureX_name+"'");
        }
        return feature;        
    }
});