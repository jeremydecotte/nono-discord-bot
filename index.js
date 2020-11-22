const discord = require("discord.js");
const axios = require("axios");
const moment = require("moment");
const path = require("path");
const fs = require("fs");
const parser = require("rss-parser");
const cheerio = require("cheerio");
const config = require("./config.json");
const {
  POINT_CONVERSION_HYBRID
} = require("constants");
require("console-stamp")(console, "dd/mm/yyyy HH:MM:ss.l");

const client = new discord.Client();

const reminders = config.REMINDERS;

const commande_prefix = "!";

// Chargement des fichiers de données.
var db = {};
const dbPath = path.join(__dirname, "db");
readDatabases();

client.on("ready", function () {
  console.log(`Le Clovis BOT est démarré à ${moment().format("DD/MM/YYYY HH:mm")} !`);
  //client.channels.cache.get(config.LOG_CHANNEL).send(`[Démarrage] - \n ${moment().format('DD/MM/YYYY HH:mm')}`);
});

var preumsDectectorOccurence = [];
var preumsDectectorTimer = null;
var kaamelottTimer = null;

// Partie "commande"
client.on("message", function (message) {
  if (message.author.bot) return;

  const commandBody = message.content.slice(commande_prefix.length);
  const args = commandBody.split(" ");
  const command = args.shift().toLowerCase();

  const isFromAdmin = message.member ? message.member.hasPermission("ADMINISTRATOR") : false;

  //if (isFromAdmin) {
  if (command === "chucknorris") {
    axios.get("https://api.chucknorris.io/jokes/random").then((response) => {
      message.reply(`tu reprendras bien un peu de chuck norris : ${response.data.value}`);
    });
  } else if (command === "kaamelott" && db["kaamelott"]) {
    clearTimeout(kaamelottTimer);
    kaamelottTimer = setTimeout(() => {
      let index = args.length > 0 && args <= db["kaamelott"].length ? args : Math.floor(Math.random() * db["kaamelott"].length);
      let citation = db["kaamelott"][index - 1];
      citation.split("|").forEach((c) => { message.reply(`(${index}/${db["kaamelott"].length}) - ${c.replace(/¤/g, "\n")}`); });
    }, 2000);
  } else if (command === "gorafi") {
    let gorafiParser = new parser();
    gorafiParser.parseURL("http://www.legorafi.fr/feed/", function (err, feed) {
      message.reply(`c'est tout chaud ça vient de sortir : ${feed.items[0].title} ${feed.items[0].link}`);
    });
  } else if (isFromAdmin && command === "reload") {
    readDatabases();
  } else if (isFromAdmin && command === "chiffres") {
    readInformations().then((d) => message.reply(d));
  }
});

// Partie "Bonjour" détector
client.on("message", function (message) {
  if (message.author.bot) return;
  //if (message.channel.id != config.BONJOUR_DETECTOR.channel) return; // commenté pour test sur poubelle

  // Si l'on détecte un message "bonjour", on lance l'analyse !
  if (config.BONJOUR_DETECTOR.words.some((w) => message.content.toLocaleLowerCase().startsWith(w.toLocaleLowerCase())) && db["toolongmessages"] && Math.floor(Math.random() * config.BONJOUR_DETECTOR.randomizer) == 0) {
    let index = Math.floor(Math.random() * db["hello"].length);
    setTimeout(() => message.reply(`${db["hello"][index]}`), 2000);
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
        message.channel.messages.fetch(messageId).then((m) => {
          switch (index) {
            case 0:
              m.react("🥇");
              break;
            case 1:
              m.react("🥈");
              break;
            case 2:
              m.react("🥉");
              break;
            case 3:
              m.react("🚜");
              break;
            case 4:
              m.react("🐌");
              break;
            case 5:
              m.react("☠️");
              break;
            case 6:
              m.reply(
                "https://tenor.com/view/bad-mauvais-oss177-tes-mauvais-gif-7523463"
              );
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
  if (message.content.startsWith("http")) return;

  if (db["toolongmessages"] && message.content.length >= config.MESSAGE_TOO_LONG_DETECTOR.length) {
    let index = Math.floor(Math.random() * db["toolongmessages"].length);
    setTimeout(() => message.channel.send(`${db["toolongmessages"][index]}`), 2000);
  }
});

function reminderFunction() {
  let today = moment().day();
  let todayReminders = reminders.filter(
    (r) => r.trigger && r.trigger.days && r.trigger.days.includes(today)
  );
  //console.log(todayReminders);
  if (todayReminders.length > 0) {
    todayReminders.forEach((r) => {
      if (r.trigger) {
        let triggersToExecute = r.trigger.at.filter((d) => d.lastTriggeredDay != today && moment().format("HH:mm") == d.time);
        triggersToExecute.forEach((t) => {
          client.channels.cache
            .get(r.channel)
            .send(`[Rappel Auto] - ${r.name} - ${r.text}`);
          t.lastTriggeredDay = today;
        });
      }
    });
  }
}

const reminderTimer = setInterval(
  reminderFunction,
  config.DEFAULT_REMINDERS_INTERVAL
); // clearInterval pour annuler le timer-interval

function readDatabases() {
  fs.readdir(dbPath, function (err, files) {
    dbFiles = files.filter((f) => path.extname(f) == ".db");
    dbFiles.forEach((file) => {
      fs.readFile(path.join(dbPath, file), (err, data) => {
        var dbName = path.basename(file, path.extname(file));
        db[dbName] = data.toString().split("\n");
        console.log(`fichier "${file}" chargé.`);
      });
    });
  });
}

function readInformations() {
  return new Promise((resolve, reject) => {
    let text = "";
    const today = moment();
    const chrismasDay = moment("2020-12-25");
    const confinementEndDay = moment("2020-12-01");
    const realConfinementEndDay = moment("2020-12-15");

    let share = {
      cac: {
        value: null,
        percent: null,
      },
      atos: {
        value: null,
        percent: null,
      },
    };

    let ephemeris = {
      sun: {
        up: null,
        down: null,
      },
    };

    let promises = [
      axios.get("https://www.boursedirect.fr/fr/marche/euronext-paris/cac-40-FR0003500008-PX1-EUR-XPAR/seance"),
      axios.get("https://www.boursedirect.fr/fr/marche/euronext-paris/atos-se-FR0000051732-ATO-EUR-XPAR/seance"),
      axios.get("https://coronavirus-19-api.herokuapp.com/countries/france"),
      axios.get("https://coronavirusapi-france.now.sh/FranceLiveGlobalData")
    ];

    Promise.all(promises).then(
      (responses) => {
        var html = cheerio.load(responses[0].data);
        share.cac.value = html("div.container-instrument-quotation > div.instrument-quotation.bd-streaming-select-anim-update > span.quotation-last.bd-streaming-select-value-last").text().split("\n")[1].trim();
        share.cac.percent = html("div.container-instrument-quotation > div.instrument-quotation.bd-streaming-select-anim-update > strong").text().split("\n")[1].trim();

        html = cheerio.load(responses[1].data);
        share.atos.value = html("div.container-instrument-quotation > div.instrument-quotation.bd-streaming-select-anim-update > span.quotation-last.bd-streaming-select-value-last").text().split("\n")[1].trim();
        share.atos.percent = html("div.container-instrument-quotation > div.instrument-quotation.bd-streaming-select-anim-update > strong").text().split("\n")[1].trim();


        const covid = responses[2].data;
        const covid2 = responses[3].data.FranceGlobalLiveData[0];

        text += `Actu : Noël c'est dans **${chrismasDay.diff(today, "days")}**j, la fin du confinement dans **${confinementEndDay.diff(today, "days")}**j selon la police et **${realConfinementEndDay.diff(today, "days")}**j selon les syndicats.\r\n`;
        text += `Bourse : Le CAC40 est à **${share.cac.value}**pts (${share.cac.percent}). L'action ATOS est à **${share.atos.value}**€ (${share.atos.percent}).\r\n`;
        text += `Covid : **${covid.cases}** cas confirmés (+${covid.todayCases}), **${covid.deaths}** décès (+${covid.todayDeaths}), **${covid2.hospitalises}** hospitalisations (+${covid2.nouvellesHospitalisations}), **${covid2.reanimation}** en réanimation (+${covid2.nouvellesReanimations}). \r\n`;
        //text += `Ephéméride : Le soleil se couchera à ${ephemeris.sun.down}.`;

        resolve(text);
      },
      (responses) => reject(responses)
    );
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