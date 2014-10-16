nodeLibrary = flow.webaudioManager.nodeLibrary();

nodeLibrary.clone("filter", "lowpassFilter", {
    type: "lowpass",
});

nodeLibrary.clone("gain", "gain-clean", {
    gain: 1,
});

nodeLibrary.clone("coAnalyser", "fft", {
    sampleRate: function() {
        return this.audioContext.context.sampleRate;
    },
});

initAudioGraph = function() {
    console.log("[Classifier] Graph Init")
    flow.webaudioManager.createAudioGraph("classifier", {
        "microphone": {
            connectTo: ["gain-clean", "lowpassFilter"]
        },
        "lowpassFilter": {
            frequency: function() {
                return this.audioContext.context.sampleRate / this.getSettings("downsample", "downsampleFactor") / 2;
            }
        },
        "downsample": {
            downsampleFactor: 2,
            bufferSize: 2048

        },
        "overlap": {
            bufferSize: 2048,
            downsampleFactor: function() {
                return this.getSettings("downsample", "downsampleFactor");
            }
        },
        "analyser": {
            smoothingTimeConstant: 0
        },
        "fft": {
            analyserNodeName: "analyser",
            connectTo: ["gain"]
        },
        "gain-clean": {
            connectTo: ["audiocontext.destination"],
        },
        "gain": {
            connectTo: ["audiocontext.destination"],
            gain: 0
        }
    });
}