require('dotenv').config();
const { Telegraf, session, Scenes, Markup } = require('telegraf');
const { default: SafeApiKit } = require("@safe-global/api-kit");

const { getUserDetails, addUserDetails } = require("./utils/firebase")
const { decryptMnemonic } = require("./utils/secureBundle")
const { createNewWallet } = require("./utils/createNewWallet")
const { getAllTokens } = require('./utils/getAllTokens');
const { getAllTxns } = require('./utils/getAllTxns');
const { getBalance } = require('./utils/getBalance');
const { replyMessages } = require("./utils/replyMessages");
const { deployContract } = require('./utils/deployContract');


const PriceWizard = new Scenes.WizardScene(
    'PriceWizard',
    ctx => {
        ctx.reply("Enter coin name (e.g. bitcoin): ");
        ctx.wizard.state = {};
        return ctx.wizard.next();
    },
    ctx => {
        ctx.wizard.state.coinName = ctx.message.text;
        ctx.reply('Enter Currency (e.g. usd)');
        return ctx.wizard.next();
    },
    async ctx => {
        ctx.wizard.state.currency = ctx.message.text;

        const resp = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ctx.wizard.state.coinName}&vs_currencies=${ctx.wizard.state.currency}`)
        const data = await resp.json()

        ctx.replyWithMarkdownV2(`Current price of *1 ${ctx.wizard.state.coinName.toUpperCase()}* is *${data[ctx.wizard.state.coinName][ctx.wizard.state.currency]} ${ctx.wizard.state.currency.toUpperCase()}*`);
        return ctx.scene.leave();
    }
);

const DeployWizard = new Scenes.WizardScene(
    'DeployWizard',
    ctx => {
        ctx.reply("Send me a Solidity file (.sol)");
        ctx.wizard.state = {};

        return ctx.wizard.next();
    },
    async ctx => {

        if (ctx.message.document && ctx.message.document.file_name.endsWith(".sol")) {

            const fileUrl = await ctx.telegram.getFileLink(ctx.message.document.file_id);
            const response = await fetch(fileUrl);

            if (response.ok) {
                const fileText = await response.text();
                if (ctx.message.document.file_name.includes(" ")) {
                    ctx.reply("The file name has whitespaces which is not supported.")
                    ctx.wizard.back()
                    return ctx.wizard.steps[ctx.wizard.cursor](ctx)
                }
                else {
                    ctx.wizard.state.fileName = ctx.message.document.file_name;
                    ctx.wizard.state.fileText = fileText;
                    ctx.reply('Enter space separated constructor arguments. If there are no constructor arguments, just send me "null"');
                    return ctx.wizard.next();
                }
            }
            else {
                ctx.reply("An error occurred while fetching the file, Plesse try again.")
                ctx.wizard.back()
                return ctx.wizard.steps[ctx.wizard.cursor](ctx)
            }
        }
        else {
            ctx.reply("Please send me only document with file extension .sol")
            ctx.wizard.back()
            return ctx.wizard.steps[ctx.wizard.cursor](ctx)
        }
    },
    ctx => {
        if (ctx.message.text) {
            if (ctx.message.text === "null") {
                ctx.wizard.state.args = null;
            }
            else {
                args = ctx.message.text.split(" ");
                ctx.wizard.state.args = args;
            }
            ctx.reply('Lastly, Enter your wallet password');
            return ctx.wizard.next();
        }
        else {
            ctx.reply("Invalid reply!")
            ctx.wizard.back()
            return ctx.wizard.steps[ctx.wizard.cursor](ctx)
        }
    },
    async ctx => {
        try {
            ctx.wizard.state.pass = ctx.message.text;

            const delMsg = await ctx.reply("Deploying the contract...")

            const contract = await deployContract(
                ctx.message.from.id.toString(),
                ctx.message.text,
                ctx.wizard.state.fileName,
                ctx.wizard.state.fileText,
                ctx.wizard.state.args
            )

            if (contract.status === 200) {
                ctx.replyWithMarkdownV2(`
Contract deployment successfull\\!
Contract address: *${contract.data.contractAddress}*
Total deployment Cost: ${contract.data.gasFeePaid.replaceAll(".", "\\.")} ETH`,
                    { reply_markup: { inline_keyboard: [[{ text: "View transaction on explorer", url: `https://goerli.etherscan.io/tx/${contract.data.transactionHash}` }]] } })
                ctx.deleteMessage(delMsg.message_id)
            }
            else {
                console.log(contract.data)
                ctx.reply(contract.msg)
                ctx.deleteMessage(delMsg.message_id)
                return ctx.scene.leave();
            }
        }
        catch (e) {
            console.log(e)
            ctx.reply("An Unknown error occurred! Don't worry, no gas fees was deducted from your account. Please try again later.")
            return ctx.scene.leave();
        }
    }
);



const stage = new Scenes.Stage([PriceWizard, DeployWizard]);

const bot = new Telegraf(process.env.BOT_API_TOKEN);
bot.use(session());
bot.use(stage.middleware());


// Start command
bot.start(async ctx => {
    ctx.replyWithSticker("CAACAgIAAxkBAANFZS2HXgk5VS9PvQ7Bk2VuowABOKpsAAIFAAPANk8T-WpfmoJrTXUwBA")
    ctx.reply("Hi there, Welcome to Plutonium Wallet.\nUse /help command to view how to use this bot.")
});

// Help command
bot.help(ctx => {
    ctx.replyWithMarkdownV2(replyMessages['HELP_MSG']())

});

// priceInfo command
bot.command('price_info', ctx => {
    ctx.scene.enter('PriceWizard');
});

// Gas Info command
bot.command('gas_info', async ctx => {
    const replyData = await ctx.reply(`Fetching data...`);

    const resp = await fetch(`https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_API_TOKEN}`)
    const data = await resp.json()

    if (data.status === "1") {
        ctx.reply(`SafeGasPrice: ${data.result.SafeGasPrice} gwei\nFastGasPrice: ${data.result.FastGasPrice} gwei\nSuggestBaseFee: ${data.result.suggestBaseFee} gwei`);
        ctx.deleteMessage(replyData.message_id)
    }
    else {
        ctx.reply(`Error fetching current Gas Fees, Please try again later.`);
        ctx.deleteMessage(replyData.message_id)
    }
});

// Create Wallet command
bot.command('create_wallet', async ctx => {
    try {
        const userD = await getUserDetails(ctx.message.from.id.toString())

        if (userD.status === 200) {
            // Wallet already found
            ctx.replyWithMarkdownV2(replyMessages['CREATE_WALLET_ALREADY_FOUND'](userD.data.addresses[0].slice(0, 6) + '\\.\\.\\.' + userD.data.addresses[0].slice(-4)))
        }
        else {
            // Wallet not found
            const replyData = await ctx.reply(`Creating wallet...`);

            const arr = ctx.message.text.split(" ")

            if (arr.length === 2) {
                const resp = await createNewWallet(arr[1]);

                if (resp.status === 200) {
                    // Wallet created successfully
                    const userId = ctx.message.from.id.toString()

                    const userData = {}
                    userData.addresses = [resp.data.address]
                    userData.currentIndex = 0
                    userData.encryptedData = JSON.stringify(resp.data.encryptedMnemonic)
                    userData.safeAddresses = [resp.data.safeAddress]
                    userData.userId = userId

                    const addResp = await addUserDetails(userId, userData)

                    if (addResp.status === 200) {
                        // Storing data in DB successful
                        ctx.replyWithMarkdownV2(replyMessages['CREATE_WALLET_SUCCESS'](resp.data.address))
                        ctx.deleteMessage(replyData.message_id)
                    }
                    else {
                        // Storing data in DB failed
                        ctx.replyWithMarkdownV2(addResp.msg)
                        ctx.deleteMessage(replyData.message_id)
                    }
                }
                else {
                    // Wallet creation failed
                    ctx.replyWithMarkdownV2(resp.msg)
                    ctx.deleteMessage(replyData.message_id)
                }
            }
            else {
                // Invalid commmand (password not provided)
                ctx.replyWithMarkdownV2(replyMessages['CREATE_WALLET_INVALID_CMD']())
            }
        }
    }
    catch (err) {
        console.log(err)
        ctx.reply(`An unknown error occurred!`);
    }
});

// View Secret Recovery Phrase command
bot.command('view_seed_phrase', async ctx => {

    try {
        if (ctx.message.chat.type === 'private') {
            const userD = await getUserDetails(ctx.message.from.id.toString())
            if (userD.status === 200) {
                // Wallet exists
                const arr = ctx.message.text.split(" ")
                if (arr.length === 2) {
                    // Password provided
                    const decrypted = await decryptMnemonic(arr[1], JSON.parse(userD.data.encryptedData))
                    if (decrypted.status === 200) {
                        // Show hidden Seed Phrase which will get deleted in 5 sec
                        const msgToDelete = await ctx.replyWithMarkdownV2(replyMessages['VIEW_SEED_SUCCESS'](decrypted.data.mnemonic))

                        // Delete msg in 5 seconds
                        setTimeout(() => {
                            ctx.deleteMessage(msgToDelete.message_id)
                            ctx.replyWithMarkdownV2("*The previous message was deleted for security purpose\\.*")
                        }, 5000);
                    }
                    else {
                        // Show error message
                        ctx.reply(decrypted.msg)
                    }
                }
                else {
                    // Invalid command given (No password provided)
                    ctx.replyWithMarkdownV2(replyMessages['VIEW_SEED_INVALID_CMD']())
                }
            }
            else {
                // No wallet found
                ctx.replyWithMarkdownV2(replyMessages['NO_WALLET_FOUND']())
            }
        }
        else {
            // Message not in private
            ctx.reply("This command is only available in Private Chats for security purposes.")
        }
    }
    catch (err) {
        console.log(err)
        ctx.reply(`An unknown error occurred!`);
    }

});

// View All Tokens command
bot.command('all_tokens', async ctx => {
    const replyData = await ctx.reply(`Fetching all token details...`);
    const userD = await getUserDetails(ctx.message.from.id.toString())

    try {
        if (userD.status === 200) {
            // Wallet exists
            const arr = ctx.message.text.split(" ")
            if (arr.length === 2) {
                const allTokensResp = await getAllTokens(ctx.message.from.id.toString(), arr[1]);

                if (allTokensResp.status === 200) {

                    const replyMarkupTiles = Object.keys(allTokensResp.data).map((key) => ([{ text: `${allTokensResp.data[key].balance} ${allTokensResp.data[key].symbol} (${allTokensResp.data[key].name})`, url: `https://goerli.etherscan.io/token/${allTokensResp.data[key].address}` }]))

                    ctx.reply("All tokens owned by you are listed below:", { reply_markup: { inline_keyboard: replyMarkupTiles } })
                    ctx.deleteMessage(replyData.message_id)

                }
                else {
                    ctx.reply(allTokensResp.msg)
                    ctx.deleteMessage(replyData.message_id)
                }
            }
            else {
                // Invalid command given (No password provided)
                ctx.replyWithMarkdownV2(replyMessages['VIEW_ALL_TOKENS_INVALID_CMD']())
                ctx.deleteMessage(replyData.message_id)
            }
        }
        else {
            // No wallet found
            ctx.replyWithMarkdownV2(replyMessages['NO_WALLET_FOUND']())
            ctx.deleteMessage(replyData.message_id)
        }
    }
    catch (err) {
        console.log(err)
        ctx.reply(`An unknown error occurred!`);
        ctx.deleteMessage(replyData.message_id)
    }
});

// Get Balance
bot.command('balance', async ctx => {
    const replyData = await ctx.reply(`Fetching balance details...`);
    const userD = await getUserDetails(ctx.message.from.id.toString())

    try {
        if (userD.status === 200) {
            // Wallet exists
            const arr = ctx.message.text.split(" ")
            if (arr.length === 2) {
                const balResp = await getBalance(ctx.message.from.id.toString(), arr[1]);

                if (balResp.status === 200) {
                    ctx.reply(balResp.data)
                    ctx.deleteMessage(replyData.message_id)
                }
                else {
                    ctx.reply(balResp.msg)
                    ctx.deleteMessage(replyData.message_id)
                }
            }
            else {
                // Invalid command given (No password provided)
                ctx.replyWithMarkdownV2(replyMessages['VIEW_BALANCE_INVALID_CMD']())
                ctx.deleteMessage(replyData.message_id)
            }
        }
        else {
            // No wallet found
            ctx.replyWithMarkdownV2(replyMessages['NO_WALLET_FOUND']())
            ctx.deleteMessage(replyData.message_id)
        }
    }
    catch (err) {
        console.log(err)
        ctx.reply(`An unknown error occurred!`);
        ctx.deleteMessage(replyData.message_id)
    }
});

// Show QR command
bot.command('show_qr', async ctx => {
    const replyData = await ctx.reply(`Fetching account details...`);
    const userD = await getUserDetails(ctx.message.from.id.toString())

    try {
        if (userD.status === 200) {
            // Wallet exists
            ctx.replyWithPhoto({ url: "https://quickchart.io/qr?text=0x68a146f881Ec7310b644A3Fe2B6da6fc82F22A9E&margin=2&size=300" }, { caption: "Scan this QR with any dApp that supports WalletConnect, to seamlessly connect your wallet with it." })
            ctx.deleteMessage(replyData.message_id)
        }
        else {
            // No wallet found
            ctx.replyWithMarkdownV2(replyMessages['NO_WALLET_FOUND']())
            ctx.deleteMessage(replyData.message_id)
        }
    }
    catch (err) {
        console.log(err)
        ctx.reply(`An unknown error occurred!`);
        ctx.deleteMessage(replyData.message_id)
    }
});

// View All Transactions
bot.command('txn_history', async ctx => {
    const replyData = await ctx.reply(`Fetching all transaction details...`);

    try {
        const userD = await getUserDetails(ctx.message.from.id.toString())
        if (userD.status === 200) {
            // Wallet exists
            const arr = ctx.message.text.split(" ")
            if (arr.length === 2) {
                const allTxnsResp = await getAllTxns(ctx.message.from.id.toString(), arr[1]);

                if (allTxnsResp.status === 200) {


                    allTxnsResp.data.results.forEach(result => {
                        const timestamp = new Date(result.executionDate).toLocaleString(
                            "default",
                            { hour: "numeric", minute: "numeric", day: "numeric", month: "short", year: "numeric" }
                        )

                        let transfers = ""
                        if (result.transfers) {
                            result.transfers.forEach((item) => {
                                transfers += `*${item.type.replaceAll("_", "\\_")}*\\: ${item.value * (10 ** -18)} ${item.tokenInfo.symbol}\n`
                            })
                        }

                        const msg = `
*Txn Type*\\: ${result.txType.replaceAll("_", "\\_")}

${transfers}
*From*\\: [${result.from.slice(0, 6) + '\\.\\.\\.' + result.from.slice(-4)}](https://goerli.etherscan.io/address/${result.from}) 
*To*\\: [${result.to.slice(0, 6) + '\\.\\.\\.' + result.to.slice(-4)}](https://goerli.etherscan.io/address/${result.to})
*At*\\: ${timestamp}`

                        ctx.replyWithMarkdownV2(msg, { disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: "View Transaction on explorer", url: `https://goerli.etherscan.io/tx/${result.txHash}` }]] } })
                    });

                    ctx.deleteMessage(replyData.message_id)
                }
                else {
                    ctx.reply(allTxnsResp.msg)
                    ctx.deleteMessage(replyData.message_id)
                }
            }
            else {
                // Invalid command given (No password provided)
                ctx.replyWithMarkdownV2(replyMessages['TXN_HISTORY_INVALID_CMD']())
                ctx.deleteMessage(replyData.message_id)
            }
        }
        else {
            // No wallet found
            ctx.replyWithMarkdownV2(replyMessages['NO_WALLET_FOUND']())
            ctx.deleteMessage(replyData.message_id)
        }
    }
    catch (err) {
        console.log(err)
        ctx.reply(`An unknown error occurred!`);
        ctx.deleteMessage(replyData.message_id)
    }
});


// Deploy Contract
bot.command('deploy', async ctx => {

    try {
        const userD = await getUserDetails(ctx.message.from.id.toString())
        if (userD.status === 200) {
            // Wallet exists
            ctx.scene.enter('DeployWizard');
        }
        else {
            // No wallet found
            ctx.replyWithMarkdownV2(replyMessages['NO_WALLET_FOUND']())
        }
    }
    catch (err) {
        console.log(err)
        ctx.reply(`An unknown error occurred!`);
    }
});


// Transfer tokens
bot.command('deploy', async ctx => {

    try {
        const userD = await getUserDetails(ctx.message.from.id.toString())
        if (userD.status === 200) {
            // Wallet exists

            const arr = ctx.message.text.split(" ")
            if (arr.length === 2) {
                const balResp = await getBalance(ctx.message.from.id.toString(), arr[1]);

                if (balResp.status === 200) {
                    ctx.reply(balResp.data)
                    ctx.deleteMessage(replyData.message_id)
                }
                else {
                    ctx.reply(balResp.msg)
                    ctx.deleteMessage(replyData.message_id)
                }
            }
            else {
                // Invalid command given (No password provided)
                ctx.replyWithMarkdownV2(replyMessages['VIEW_BALANCE_INVALID_CMD']())
                ctx.deleteMessage(replyData.message_id)
            }

        }
        else {
            // No wallet found
            ctx.replyWithMarkdownV2(replyMessages['NO_WALLET_FOUND']())
        }
    }
    catch (err) {
        console.log(err)
        ctx.reply(`An unknown error occurred!`);
    }
});

bot.launch();