nodeLibrary = flow.webaudioManager.nodeLibrary();
nodeLibrary.clone("gain", "gain-clean", {
    gain: 1,
});

nodeLibrary.clone("coAnalyser", "fft", {
    sampleRate: function() {
        return this.audioContext.context.sampleRate;
    },
});

initAudioGraph = function() {
    flow.webaudioManager.createAudioGraph("classifier", {
        "microphone": {
            connectTo: ["gain-clean", "lowpassFilter"]
        },
        "lowpassFilter": {
            type: "lowpass",
            frequency: function() {
                return this.audioContext.context.sampleRate / this.getSettings("downsample", "downsampleFactor") / 2;
            }
        },
        "downsample": {
            downsampleFactor: 2,

        },
        "overlap": {
            bufferSize: 2048,
            downsampleFactor: function() {
                return this.getSettings("downsample", "downsampleFactor");
            }
        },
        // "hanningWindow": {
        //     bufferSize: 2048,
        // },
        "passThrough": {},
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