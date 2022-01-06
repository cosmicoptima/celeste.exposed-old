var axios = require("axios")
var wikidata = require("wikidata-sdk")

function randomChoice(list) {
  return list[Math.round(Math.random() * list.length)]
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
    if (
      propertyName.includes("ID") ||
      propertyName.includes("identifier") ||
      propertyName.includes("code")
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

        f(a, propertyName, b)
      } else randomTriple(f)
    })
  })
}

function setFunFact(a, p, b) {
  document.getElementById("fun-fact").innerHTML = `${a} <b>has ${p}</b> ${b}`
}

function reload() {
  document.getElementById("fun-fact").innerHTML = "<i>loading...</i>"
  randomTriple(setFunFact)
}

document.getElementById("reload-fun-fact").onclick = reload
randomTriple(setFunFact)
