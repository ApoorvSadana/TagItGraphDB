const { v4 } = require("uuid");
const driver = require("../models");

async function createChallenge(req, res) {
  try {
    let data = req.body;
    let id = v4();
    const session = driver.session();
    await session.run(
      "CREATE (challenge:Challenge {id:$id,hashtag:$hashtag,live:$live,\
                shortDesc:$shortDesc,longDesc:$longDesc,poweredBy:$poweredBy,\
                poweredByUrl:$poweredByUrl,backgroundUrl:$backgroundUrl,donationPerUser:$donationPerUser,\
                currencyCode:$currencyCode})",
      {
        id: id,
        hashtag: data.hashtag,
        live: data.live,
        shortDesc: data.shortDesc,
        longDesc: data.longDesc,
        poweredBy: data.poweredBy,
        poweredByUrl: data.poweredByUrl,
        backgroundUrl: data.backgroundUrl,
        donationPerUser: data.donationPerUser,
        currencyCode: data.currencyCode,
      }
    );
    await session.close();
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
}

module.exports = {
  createChallenge,
};
