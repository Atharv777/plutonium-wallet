require('dotenv').config();
const { Telegraf, session, Scenes, Markup } = require('telegraf');
const { default: SafeApiKit } = require("@safe-global/api-kit");

const { getUserDetails, addUserDetails } = require("./utils/firebase")
const { decryptMnemonic } = require("./utils/secureBundle")
const { createNewWallet } = require("./utils/createNewWallet")
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

bot.launch();