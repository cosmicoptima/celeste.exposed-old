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

    let query = `SELECT ?aLabel ?bLabel WHERE {
                   ?a wdt:${propertyID} ?b.
	           SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
                 }`
    axios.get(wikidata.sparqlQuery(query)).then(res => {
      let choice = randomChoice(res.data.results.bindings)
      let [a, b] = [choice.aLabel.value, choice.bLabel.value]

      f(a, propertyName, b)
    })
  })
}

function setFunFact(a, p, b) {
  document.getElementById("fun-fact").innerHTML = `${a} <b>(is/has) ${p}</b> ${b}`
}

randomTriple(setFunFact)
