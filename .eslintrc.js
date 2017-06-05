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
        "indent": ["error", "tab"],
        "no-tabs": 0,
        "no-underscore-dangle": 0,
        "no-restricted-syntax": 0,
        "no-loop-func": 0,
        "import/prefer-default-export" : 0,
        "no-shadow": 0, //TODO : Enable this rule
        "no-param-reassign": 0, //TODO : Enable this rule
        "func-names" : 0 //TODO : Enable this rule
    }
};