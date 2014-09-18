Package.describe({
    summary: "uses k-Nearest-Neighbor to classify audio signals",
    version: "0.0.1",
    git: " \* PRIVATE *\ "
});

Package.onUse(function(api, where) {

    api.use(['flow-core', 'webaudio-manager', 'audiofeatures']); // private packages look at smart.json
    api.use(['flowkey:math-tools', 'flowkey:functionstack', 'flowkey:dsp', 'flowkey:histogram', 'underscore']); // community packages -> athmosphere


    // add kNN
    api.addFiles(['kNN/lib/kNearestNeighbor.js', 'kNN/lib/draw.js'], 'client');

    // add classifier
    api.addFiles(['lib/classifierGraph.js', 'lib/flow-classifier.js'], 'client');

    api.export('Classifier');
});

Package.onTest(function(api) {
    api.use('flow-classifier');

    api.add_files('tests/flow-classifier_tests.js', ['client']);
});


