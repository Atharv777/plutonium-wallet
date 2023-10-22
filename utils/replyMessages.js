module.exports.replyMessages = {
    HELP_MSG: () => {
        return (`
Use '*/create\\_wallet \\<password\\>*' to create a new wallet\\.
Use '*/view\\_seed\\_phrase \\<password\\>*' to view the Secret Phrase of the account created\\.
Use '*/all\\_tokens \\<password\\>*' to balances of all the tokens you own\\.
Use */balance \\<password\\>* to view the native token balance of the wallet\\.
Use '*/txn\\_history \\<password\\>*' to view transaction history of your wallet\\.
Use */deploy* to deploy a solidity smart contract by using source code file\\.
Use */price\\_info* to get current price of a coin\\.
Use */gas\\_info* to get current gas price\\.
Use */show\\_qr* to view the QR Code to connect to dapps or to transfer funds\\.
`)
    },

    CREATE_WALLET_SUCCESS: (address) => {
        return (`
Wallet with address ${address} is successfully created
Make sure you don\\'t share this password with anyone\\.
Type */view\\_seed\\_phrase \\<password\\>* to view your secret recovery phrase\\. 
*NOTE\\: DO NOT SHARE THIS SECRET PHRASE WITH ANYONE*\\.`)
    },

    CREATE_WALLET_INVALID_CMD: () => { return ("Invalid command given\\!\nPlease use '*/create\\_wallet \\<password\\>*' command to create a new wallet\\. *Note*\\: Password should not contain whitespaces\\.") },

    CREATE_WALLET_ALREADY_FOUND: (address) => { return (`Wallet with address ${address} already exists\\!`) },

    VIEW_SEED_SUCCESS: (mnemonic) => {
        return (`
This is your Secret Recovery Phrase: 
${"||" + mnemonic + "||"}

It is hidden by default for security purpose, click to view it\\.
After *5 seconds* this message will get deleted\\.
*NOTE: DO NOT SHARE THIS SECRET PHRASE WITH ANYONE EVER\\.*`)
    },

    NO_WALLET_FOUND: () => { return ("No wallet found\\!\nPlease use '*/create\\_wallet \\<password\\>*' command to create a new wallet\\.") },

    VIEW_SEED_INVALID_CMD: () => { return ("Invalid command given\\!\nPlease use '*/view\\_seed\\_phrase \\<password\\>*' command to view your secret recovery phrase\\.\n*NOTE\\: DO NOT SHARE THIS SECRET PHRASE WITH ANYONE*\\.") },

    VIEW_ALL_TOKENS_INVALID_CMD: () => { return ("Invalid command given\\!\nPlease use '*/all\\_tokens \\<password\\>*' command to view balances of all the tokens in your account\\.") },

    VIEW_BALANCE_INVALID_CMD: () => { return ("Invalid command given\\!\nPlease use '*/balance \\<password\\>*' command to view balances of all the tokens in your account\\.") },

    TXN_HISTORY_INVALID_CMD: () => { return ("Invalid command given\\!\nPlease use '*/txn\\_history \\<password\\>*' command to view transaction history of your account\\.") }
}