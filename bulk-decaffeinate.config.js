module.export = {
    searchDirectory : [
        "src/**/*.coffee",
        "test/**/*.coffee",
    ],
    mochaEnvFilePattern : "test/**/*.coffee",
    decaffeinateArgs : ["--keep-commonjs"]
};