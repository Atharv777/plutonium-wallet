require('dotenv').config();
const { Telegraf, session, Scenes, Markup } = require('telegraf');

const PriceWizard = new Scenes.WizardScene(
    'PriceWizard',
    ctx => {
        ctx.reply("Enter coin name (e.g. bitcoin): ", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Button 1", callback_data: "btn-1" }, { text: "Button 2", callback_data: "btn-2" }]
                ]
            }
        });
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

        ctx.reply(`Current price of 1 ${ctx.wizard.state.coinName.toUpperCase()} is ${data[ctx.wizard.state.coinName][ctx.wizard.state.currency]} ${ctx.wizard.state.currency.toUpperCase()}`);
        return ctx.scene.leave();
    }
);
const GasInfoWizard = new Scenes.WizardScene(
    'GasInfoWizard',
    async ctx => {

        const replyData = await ctx.reply(`Fetching data...`);

        const resp = await fetch(`https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_API_TOKEN}`)
        const data = await resp.json()

        ctx.deleteMessage(replyData.message_id)
        if (data.status === "1") {
            ctx.reply(`SafeGasPrice: ${data.result.SafeGasPrice} gwei\nFastGasPrice: ${data.result.FastGasPrice} gwei\nSuggestBaseFee: ${data.result.suggestBaseFee} gwei`);
        }
        else {
            ctx.reply(`Error fetching current Gas Fees, Please try again later.`);
        }
        return ctx.scene.leave();
    }
);


const stage = new Scenes.Stage([PriceWizard, GasInfoWizard]);

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
    ctx.replyWithMarkdownV2(`
Use */priceInfo* to get current price of a coin\\.
Use */gasInfo* to get current gas price\\.
`)

});

// priceInfo command
bot.command('priceInfo', ctx => {
    ctx.scene.enter('PriceWizard');
});

// gasInfo command
bot.command('gasInfo', ctx => {
    ctx.scene.enter('GasInfoWizard');
});


bot.launch();