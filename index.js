const discord = require("discord.js");
const axios = require('axios');
const moment = require('moment');
const path = require('path');
const fs = require('fs');
const parser = require('rss-parser');
const config = require("./config.json");
require('console-stamp')(console, 'dd/mm/yyyy HH:MM:ss.l');


const client = new discord.Client();

const reminders = config.REMINDERS;

const commande_prefix = "!";

// Chargement des fichiers de données.
var db = {};
const dbPath = path.join(__dirname, 'db');
readDatabases();

client.on("ready", function () {
  console.log(`Le Clovis BOT est démarré à ${moment().format('DD/MM/YYYY HH:mm')} !`);
  //client.channels.cache.get(config.LOG_CHANNEL).send(`[Démarrage] - \n ${moment().format('DD/MM/YYYY HH:mm')}`);
});

var preumsDectectorOccurence = [];
var preumsDectectorTimer = null;
var kaamelottTimer = null;

// Partie "commande"
client.on("message", function (message) {
  if (message.author.bot) return;

  const commandBody = message.content.slice(commande_prefix.length);
  const args = commandBody.split(' ');
  const command = args.shift().toLowerCase();

  const isFromAdmin = (message.member ? message.member.hasPermission("ADMINISTRATOR") : false);

  //if (isFromAdmin) {
  if (command === "chucknorris") {
    axios.get('https://api.chucknorris.io/jokes/random')
      .then(response => {
        message.reply(`tu reprendras bien un peu de chuck norris : ${response.data.value}`);
      });
  }
  else if (command === "kaamelott" && db['kaamelott']) {
    clearTimeout(kaamelottTimer);
    kaamelottTimer = setTimeout(() => {
      let index = (args.length > 0 && args <= db['kaamelott'].length) ? args : Math.floor(Math.random() * db['kaamelott'].length);
      let citation = db['kaamelott'][index - 1];
      citation.split('|').forEach((c) => {
        message.reply(`(${index}/${db['kaamelott'].length}) - ${c.replace(/¤/g, '\n')}`);
      });
    }, 2000);
  }
  else if (command === "gorafi") {
    let gorafiParser = new parser();
    gorafiParser.parseURL("http://www.legorafi.fr/feed/", function (err, feed) {
      message.reply(`c'est tout chaud ça vient de sortir : ${feed.items[0].title} ${feed.items[0].link}`);
    });
  }
  else if (isFromAdmin && command === "reload") {
    readDatabases();
  }
});

// Partie "Bonjour" détector
client.on("message", function (message) {
  if (message.author.bot) return;
  //if (message.channel.id != config.BONJOUR_DETECTOR.channel) return; // commenté pour test sur poubelle

  // Si l'on détecte un message "bonjour", on lance l'analyse !
  if (config.BONJOUR_DETECTOR.words.some((w) => message.content.toLocaleLowerCase().startsWith(w.toLocaleLowerCase()))
    && db['toolongmessages']
    && Math.floor(Math.random() * config.BONJOUR_DETECTOR.randomizer) == 0) {
    let index = Math.floor(Math.random() * db['hello'].length);
    setTimeout(() => message.reply(`${db['hello'][index]}`), 2000);

  }
});

// Partie "preums détector"
client.on("message", function (message) {
  if (message.author.bot) return;
  if (message.channel.id != config.PREUMS_DETECTOR.channel) return;

  // Si l'on détecte un message "preums", on lance l'analyse !
  if (config.PREUMS_DETECTOR.words.some((w) => message.content.toLocaleLowerCase().startsWith(w.toLocaleLowerCase()))) {
    // On lance le timer de RAZ du "preums détector"
    clearTimeout(preumsDectectorTimer);
    preumsDectectorTimer = setTimeout(() => {
      preumsDectectorOccurence = [];
    }, config.PREUMS_DETECTOR.delay);

    preumsDectectorOccurence.push(message.id);
    // Si il y a + de 2 joueurs dans le laps de temps, alors on donne des récompenses !
    if (preumsDectectorOccurence.length > 1) {
      preumsDectectorOccurence.forEach((messageId, index) => {
        message.channel.messages.fetch(messageId).then(m => {
          switch (index) {
            case 0:
              m.react('🥇');
              break;
            case 1:
              m.react('🥈');
              break;
            case 2:
              m.react('🥉');
              break;
            case 3:
              m.react('🚜');
              break;
            case 4:
              m.react('🐌');
              break;
            case 5:
              m.react('☠️');
              break;
            case 6:
              m.reply('https://tenor.com/view/bad-mauvais-oss177-tes-mauvais-gif-7523463');
              break;
          }
        });
      });
    }
  }
});

// Partie "kaamelott messages trop long"
client.on("message", function (message) {
  if (message.author.bot) return;
  if (message.channel.id != config.MESSAGE_TOO_LONG_DETECTOR.channel) return;
  if (message.content.startsWith('http')) return;

  if (db['toolongmessages'] && message.content.length >= config.MESSAGE_TOO_LONG_DETECTOR.length) {
    let index = Math.floor(Math.random() * db['toolongmessages'].length);
    setTimeout(() => message.channel.send(`${db['toolongmessages'][index]}`), 2000);
  }
});

function reminderFunction() {
  let today = moment().day();
  let todayReminders = reminders.filter((r) => r.trigger && r.trigger.days && r.trigger.days.includes(today));
  //console.log(todayReminders);
  if (todayReminders.length > 0) {
    todayReminders.forEach((r) => {
      if (r.trigger) {
        let triggersToExecute = r.trigger.at.filter((d) => d.lastTriggeredDay != today && moment().format('HH:mm') == d.time);
        triggersToExecute.forEach((t) => {
          client.channels.cache.get(r.channel).send(`[Rappel Auto] - ${r.name} - ${r.text}`);
          t.lastTriggeredDay = today;
        });
      }
    });
  }
}

const reminderTimer = setInterval(reminderFunction, config.DEFAULT_REMINDERS_INTERVAL); // clearInterval pour annuler le timer-interval

function readDatabases() {
  fs.readdir(dbPath, function (err, files) {
    dbFiles = files.filter((f) => (path.extname(f) == ".db"));
    dbFiles.forEach((file) => {
      fs.readFile(path.join(dbPath, file), (err, data) => {
        var dbName = path.basename(file, path.extname(file));
        db[dbName] = data.toString().split("\n");
        console.log(`fichier "${file}" chargé.`);
      })
    });
  });

}

client.login(config.BOT_TOKEN);


// client.on("message", function (message) {
// if (message.channel.name == config.HELP_CHANNEL_NAME) {
//   message.react('🤞');
// }
// client.on('messageReactionAdd', function (reaction, user) {
//   if (!user.bot) {
//     let message = reaction.message, emoji = reaction.emoji;
//     console.log(emoji);

//     if (message.channel.name == config.HELP_CHANNEL_NAME && emoji.name == '✅') {
//       console.log('suppression du message');
//       message.delete();
//     }
//   }
// });
