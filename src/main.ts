import { Bot, session } from 'grammy';
import { collateralRatio } from './mirror';
import { concatMapTo, from, Observable, Subscription, timer } from 'rxjs';
import { MyContext, Session, PositionDetail } from './interface';
import { FileAdapter } from '@satont/grammy-file-storage';
import { Router } from '@grammyjs/router';
import { TERRA_ADDRESS_REGEX } from './constants';

require('dotenv').config();

// bot instances
const bot = new Bot<MyContext>(process.env.TELEGRAM_KEY as string);
const router = new Router<MyContext>((ctx) => ctx.session.step);

// global poller declaration
const poller = timer(0, 3600000);
let positionSub: Subscription;

// create session
bot.use(
  session({
    initial: (): Session => ({ step: 'idle' }),
    storage: new FileAdapter({
      dirName: 'sessions',
    }),
  })
);

/*
  Bot Commands
*/
bot.command('start', async (ctx) => {
  if (ctx.session.wallet == undefined) {
    await ctx.reply(`Send /wallet to start notification registration process`);
  } else {
    await ctx.reply(`Hello, your wallet address is ${ctx.session.wallet}.`);
    if (positionSub !== undefined) await ctx.reply(`Polling is active`);
    else
      await ctx.reply(
        `Polling is not active, send /poll to start polling service`
      );
    await ctx.reply(`Send /help to see list of commands`);
  }
});

bot.command('wallet', async (ctx) => {
  ctx.session.step = 'wallet';
  await ctx.reply(`Please enter a valid terra wallet address`);
});

bot.command('ratio', async (ctx) => {
  ctx.session.step = 'ratio';
  await ctx.reply(`Please enter your ratio threshold for alert`);
});

bot.command('stop', async (ctx) => {
  positionSub.unsubscribe();
  await ctx.reply(`Stopped monitoring collateral ratio threshold`);
});

bot.command('poll', async (ctx) => {
  await ctx.reply(`Start polling`);
  const positionPoller: Observable<PositionDetail[]> = poller.pipe(
    concatMapTo(from(collateralRatio(ctx.session.wallet as string)))
  );
  positionSub = positionPoller.subscribe((positions) => {
    positions.forEach(async (position) => {
      if (position.collateralRatio < (ctx.session.ratio ?? 0))
        await ctx.reply(
          `Warning! Collateral ratio is low for *${position.assetName}*` +
            ` at *${Math.round(position.collateralRatio)}%*\n` +
            `Send /stop to stop monitoring`,
          { parse_mode: 'Markdown' }
        );
    });
  });
});

bot.command('positions', async (ctx) => {
  const positions = await collateralRatio(ctx.session.wallet as string);
  positions.forEach(async (position) => {
    await ctx.reply(
      `Asset Name: ${position.assetName}\n` +
        `Asset Price: $${position.assetPrice.toFixed(2)}\n` +
        `Asset Amount: ${position.assetAmount.toFixed(2)}\n` +
        `Collateral Amount: $${position.collateralAmount.toFixed(2)}\n` +
        `Collateral Ratio: ${position.collateralRatio.toFixed(2)}%`
    );
  });
});

bot.command('status', async (ctx) => {
  if (positionSub === undefined)
    await ctx.reply('Polling is inactive, send /poll to start');
  else await ctx.reply('Polling is active');
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    'List of commands\n' +
      '/start: Check if wallet has been registered\n' +
      '/wallet: Start wallet registration and notification service process\n' +
      '/ratio: Modify ratio threshold for alerts\n' +
      '/poll: Start polling service (Polls hourly)\n' +
      '/stop: Stop polling service\n' +
      '/positions: List current positions\n' +
      '/status: Check polling status'
  );
});

/*
  Routing
*/
router.route('wallet', async (ctx) => {
  const wallet = ctx.msg?.text ?? '';

  if (!TERRA_ADDRESS_REGEX.test(wallet)) {
    await ctx.reply(`Invalid wallet, please send /wallet and try again`);
    return;
  }
  ctx.session.wallet = wallet;
  ctx.session.chatId = ctx.chat?.id.toString();
  await ctx.reply(`Registering your wallet address for notification service`);

  ctx.session.step = 'ratio';
  await ctx.reply(`Please enter your ratio threshold for alert`);
});

router.route('ratio', async (ctx) => {
  if (ctx.session.wallet === undefined) {
    await ctx.reply(
      `I need your wallet address! Please enter a valid terra wallet address`
    );
    ctx.session.step = 'wallet';
    return;
  }

  const ratio = parseInt(ctx.msg?.text ?? '0');
  if (ratio === 0 || isNaN(ratio)) {
    await ctx.reply(
      `Invalid ratio, please use the buttons or send number greater than 1`
    );
    return;
  }
  ctx.session.ratio = ratio;
  await ctx.reply(
    `You have set ${ratio}% as your notification threshold \nSend /poll to start notification service`
  );
  ctx.session.step = 'done';
});

router.route('idle', async (ctx) => {
  await ctx.reply(`Idling`);
});

bot.use(router);

/*
Start bot
*/
console.log(`Starting bot at ${new Date()}`);
bot.start();
bot.catch((err) => console.log(err));
