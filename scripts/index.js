var axios = require("axios")
var scriptjs = require("scriptjs")
var wikidata = require("wikidata-sdk")

function randomChoice(list) {
  return list[Math.floor(Math.random() * list.length)]
}

function randomProperty(f) {
  let p = axios.get("https://quarry.wmcloud.org/run/45013/output/1/json")
  p.then(res => f(randomChoice(res.data.rows)))
}

function randomTriple(f) {
  randomProperty(property => {
    let [propertyID, propertyName] = property
    // ID properties aren't very fun; we will forbid them
    // this is not completely accurate and never will be
    let pnLower = propertyName.toLowerCase()
    if (
      pnLower.includes("code") ||
      pnLower.includes("id") ||
      pnLower.includes("identifier") ||
      pnLower.includes("slug")
    ) { randomTriple(f); return }

    let query = `SELECT ?aLabel ?bLabel
                 WHERE {
                   ?a wdt:${propertyID} ?b.
                   SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
                 }
                 LIMIT 100`
    axios.get(wikidata.sparqlQuery(query)).then(res => {
      let choices = res.data.results.bindings
      if (choices.length > 0) {
        let choice = randomChoice(res.data.results.bindings)
        let [a, b] = [choice.aLabel.value, choice.bLabel.value]

        // unnamed objects aren't very fun either
        // (such objects have labels like Q123456789)
        if (!isNaN(parseInt(a.slice(1)))) { randomTriple(f); return }

        if (b.startsWith("http://") || b.startsWith("https://")) {
          b = "<a href='" + b + "'>[link]</a>"
        }

        f(a, propertyName, b)
      } else randomTriple(f)
    })
  })
}

function setFunFact(a, p, b) {
  let pFirstWord = p.split(" ")[0]
  if (pFirstWord.endsWith("ed") || p.endsWith(" of") || p.endsWith(" to")) { var prefix = "is " }
  else if (pFirstWord.endsWith("s")) { var prefix = "" }
  else { var prefix = "has " }

  document.getElementById("fun-fact").innerHTML = `${a} <b>${prefix}${p}</b> ${b}`
}

function reload() {
  document.getElementById("fun-fact").innerHTML = "<i>loading…</i>"
  randomTriple(setFunFact)
}


scriptjs("https://cdn.jsdelivr.net/npm/jaaulde-cookies/lib/jaaulde-cookies.min.js", () => {
  var visits = parseInt(cookies.get("visits"))
  if (visits === null) visits = 1; else visits++
  cookies.set("visits", visits)

  if (visits < 1) { var visitMessage = `you have apparently visited this site ${visits} times.` }
  else if (visits === 1) { var visitMessage = "you have visited this site 1 time. welcome!" }
  else if (visits < 5) { var visitMessage = `you have visited this site ${visits} times. that is a normal amount.` }
  else if (visits < 25) { var visitMessage = `you have visited this site ${visits} times. are you procrastinating?` }
  else { var visitMessage = `you have visited this site ${visits} times. this is getting creepy!` }

  document.getElementById("subheader").innerHTML = randomChoice([
    visitMessage, visitMessage, visitMessage,
    "you have lost the game!",
    "you have lost the game!",
    "you are now in control of your blinking!",
    "you are now in control of your breathing!",
    "you may now attend to that itch you've been neglecting!"
  ])
})

document.getElementById("reload-fun-fact").onclick = reload
randomTriple(setFunFact)
