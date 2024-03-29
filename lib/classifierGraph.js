_.extend(Classifier.prototype, {

    initAudioGraph: function() {

        /*
         *  Clone Nodes
         */

        var nodeLibrary = this.webaudioManager.nodeLibrary;

        nodeLibrary.clone("filter", "lowpassFilter", {
            type: "lowpass",
        });

        nodeLibrary.clone("gain", "gain-clean", {
            gain: 1,
        });

        nodeLibrary.clone("analyser", "analyser-preprocessed", {});

        nodeLibrary.clone("coAnalyser", "fft-preprocessed", {
            sampleRate: function() {
                return this.audioContext.sampleRate / this.getSettings("downsampleAndOverlap", "downsampleFactor");
            },
        });


        /*
         *  Create Graph
         */

        this.webaudioManager.createAudioGraph("classifier", {
            "microphone": {
                connectTo: [{node: "gain-clean"}, {node: "lowpassFilter"}]
            },
            "lowpassFilter": {
                frequency: function() {
                    var downsampleFactor = this.getSettings("downsampleAndOverlap", "downsampleFactor");
                    var sampleRate = this.audioContext.sampleRate;
                    return (sampleRate / downsampleFactor) / 2;
                }
            },
            "downsampleAndOverlap": {
                bufferSize: 2048,
                downsampleFactor: 2,
            },
            "analyser-preprocessed": {
                smoothingTimeConstant: 0
            },
            "fft-preprocessed": {
                analyserNodeName: "analyser-preprocessed",
                connectTo: [{node: "gain"}]
            },
            "gain-clean": {
                connectTo: [{node: "audiocontext.destination"}],
                gain: 1
            },
            "gain": {
                connectTo: [{node: "audiocontext.destination"}],
                gain: 0
            }
        });
    },
});