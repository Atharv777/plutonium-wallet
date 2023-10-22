require('dotenv').config();
const { Telegraf, session, Scenes, Markup } = require('telegraf');
const { default: SafeApiKit } = require("@safe-global/api-kit");

const { getUserDetails, addUserDetails } = require("./utils/firebase")
const { decryptMnemonic } = require("./utils/secureBundle")
const { createNewWallet } = require("./utils/createNewWallet")
const { getBalance } = require("./utils/getBalance")
const { getAllTokens } = require('./utils/getAllTokens');
const { getAllTxns } = require("./utils/getAllTxns")
const { replyMessages } = require("./utils/replyMessages");


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


                // const userId = ctx.message.from.id.toString()
                // const userData = {}

                // const addResp = await addUserDetails(userId, userData)

                // if (addResp.status === 200) {
                //     // Storing data in DB successful
                //     ctx.replyWithMarkdownV2(replyMessages['CREATE_WALLET_SUCCESS'](resp.data.address))
                //     ctx.deleteMessage(replyData.message_id)
                // }
                // else {
                //     // Storing data in DB failed
                //     ctx.replyWithMarkdownV2(addResp.msg)
                //     ctx.deleteMessage(replyData.message_id)
                // }


                ctx.replyWithMarkdownV2(replyMessages['CREATE_WALLET_SUCCESS'](resp.data.address))
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
});

// View Secret Recovery Phrase command
bot.command('view_seed_phrase', async ctx => {

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

// Show QR command
bot.command('show_qr', async ctx => {
    const replyData = await ctx.reply(`Fetching account details...`);
    const userD = await getUserDetails(ctx.message.from.id.toString())

    try {
        if (userD.status === 200) {
            // Wallet exists
            ctx.replyWithPhoto({ url: `https://quickchart.io/qr?text=${userD.data.safeAddresses[userD.data.currentIndex]}&margin=2&size=300"` }, { caption: "Scan this QR with any wallet to receive tokens in your wallet." })
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

bot.launch();