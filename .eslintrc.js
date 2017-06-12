module.exports = {
    "extends": "airbnb-base",
    "plugins": [
        "import"
    ],
    "rules": {
        "linebreak-style": 0,
        "quotes": ["warn", "double"],
        "space-before-function-paren": 0,
        "max-len": 0,
        "indent": 0,
        "no-tabs": 0,
        "no-underscore-dangle": 0,
        "no-restricted-syntax": 0,
        "no-loop-func": 0,
        "import/prefer-default-export" : 0,
		"no-plusplus":0,
		"comma-dangle" : 0,
		"no-else-return":0,
		"new-cap":0,
		"no-return-assign":0,
		"no-continue":0,
		"no-console":0,
		"no-multi-str":0,
		"no-new-object":0,
		"no-await-in-loop":0,
        "no-shadow": 0, //TODO : Enable this rule
        "no-param-reassign": 0, //TODO : Enable this rule
        "func-names" : 0, //TODO : Enable this rule,
		"no-unused-vars" : 0, //TODO : Enable this rule,
		"import/no-named-as-default-member" : 0, //TODO : Enable this rule,
		"no-use-before-define" :0, //TODO : Enable this rule
		"camelcase" :0, //TODO : Enable this rule,
		"no-multi-assign" : 0, //TODO : Enable this rule,
		"import/no-mutable-exports" : 0, //TODO : Enable this rule, 
		"consistent-return": 0, //TODO : Enable this rule
		"guard-for-in" : 0, //TODO : Enable this rule, 
		"arrow-parens" : 0, //TODO : Enable this rule, 
    }
};