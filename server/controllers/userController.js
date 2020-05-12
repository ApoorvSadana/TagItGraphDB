const { v4 } = require("uuid");
const driver = require("../models");
const neo4jDriver = require("../utils/neo4jDriver");
const phoneNumbers = require("../utils/phoneNumbers")

async function loginWithGoogle(req, res) {
  let data = req.body;
  console.log(data);
  const session = driver.session();
  const tx = session.beginTransaction();
  let promises = [];
  try {
    promises.push(
      tx.run("MATCH (user:User {email:$email}) return user", {
        email: data.user.email,
      })
    );
    promises.push(
      tx.run(
        "MATCH (user:User {email:$email}) WHERE (user)-[:googleAuthDetails]->() return user",
        {
          email: data.user.email,
        }
      )
    );
    let [user, userWithGoogleAuth] = await Promise.all(promises);
    let expoToken = data.expoToken;
    if (!expoToken) {
      expoToken = null;
    }
    if (user.records.length === 0) {
      let userId = data.UUID;
      await tx.run(
        "CREATE (user:User {id:$id,name:$name,email:$email,profilePicUrl:$profilePicUrl,expoToken:$expoToken}) \
                -[:googleAuthDetails]-> \
                (googleUser:GoogleUser {id:$id,name:$name,accessToken:$accessToken,idToken:$idToken,refreshToken:$refreshToken,latestResponse:$data})",
        {
          id: userId,
          name: data.user.name,
          email: data.user.email,
          profilePicUrl: data.user.photoUrl,
          accessToken: data.accessToken,
          idToken: data.idToken,
          refreshToken: data.refreshToken,
          data: JSON.stringify(data),
          expoToken: expoToken
        }
      );
      await tx.commit();
      res.status(200).send({ userId: userId, phoneVerificationReq: true });
    } else if (
      user.records.length !== 0 &&
      userWithGoogleAuth.records.length === 0
    ) {
      let promises2 = [];
      promises2.push(tx.run(
        "CREATE (googleUser:GoogleUser {id:$id,name:$name,accessToken:$accessToken,idToken:$idToken,refreshToken:$refreshToken,latestResponse:$data}) \
                WITH googleUser \
                MATCH (user:User {email:$email}) \
                CREATE (user)-[:googleAuthDetails]->(googleUser)",
        {
          id: user.records[0]._fields[0].properties.id,
          name: data.user.name,
          email: data.user.email,
          accessToken: data.accessToken,
          idToken: data.idToken,
          refreshToken: data.refreshToken,
          data: JSON.stringify(data),
        }
      ));
      promises2.push(tx.run(
        "MATCH (user:User {email:$email}) SET user.expoToken = $expoToken",
        {
          email: data.user.email,
          expoToken: expoToken
        }
      ));
      await Promise.all(promises2);
      await tx.commit();
    } else {
      await tx.run(
        "MATCH (user:User {email:$email}) SET user.expoToken = $expoToken",
        {
          email: data.user.email,
          expoToken: expoToken
        }
      )
      await tx.commit();
      res.status(200).send({
        userId: user.records[0]._fields[0].properties.id,
        phoneVerificationReq:
          user.records[0]._fields[0].properties.phoneNumber === undefined
            ? true
            : false,
      });
    }
    await session.close();
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
}

async function loginWithFacebook(req, res) {
  let data = req.body;

  const session = driver.session();
  const tx = session.beginTransaction();
  let promises = [];
  try {
    promises.push(
      tx.run("MATCH (user:User {email:$email}) return user", {
        email: data.email,
      })
    );
    promises.push(
      tx.run(
        "MATCH (user:User {email:$email}) WHERE (user)-[:facebookAuthDetails]->() return user",
        {
          email: data.email,
        }
      )
    );
    let [user, userWithFacebookAuth] = await Promise.all(promises);
    let expoToken = data.expoToken;
    if (!expoToken) {
      expoToken = null;
    }
    if (user.records.length === 0) {
      let userId = data.UUID;
      await tx.run(
        "CREATE (user:User {id:$id,name:$name,email:$email,profilePicUrl:$profilePicUrl,expoToken:$expoToken}) \
                -[:facebookAuthDetails]-> \
                (facebookUser:FacebookUser {id:$id,name:$name,accessToken:$accessToken,picture:$picture,latestResponse:$data})",
        {
          id: userId,
          name: data.name,
          email: data.email,
          profilePicUrl: data.picture.data.url,
          accessToken: data.accessToken,
          picture: JSON.stringify(data.picture),
          data: JSON.stringify(data),
          expoToken: expoToken
        }
      );
      await tx.commit();
      res.status(200).send({ userId: userId, phoneVerificationReq: true });
    } else if (
      user.records.length !== 0 &&
      userWithFacebookAuth.records.length === 0
    ) {
      let promises2 = [];
      promises2.push(tx.run(
        "CREATE (facebookUser:FacebookUser {id:$id,name:$name,accessToken:$accessToken,picture:$picture,latestResponse:$data}) \
                WITH facebookUser \
                MATCH (user:User {email:$email}) \
                CREATE (user)-[:facebookAuthDetails]->(facebookUser)",
        {
          id: user.records[0]._fields[0].properties.id,
          name: data.name,
          email: data.email,
          accessToken: data.accessToken,
          picture: JSON.stringify(data.picture),
          data: JSON.stringify(data),
        }
      ));
      promises2.push(tx.run(
        "MATCH (user:User {email:$email}) SET user.expoToken = $expoToken",
        {
          email: data.email,
          expoToken: expoToken
        }
      ));
      await Promise.all(promises2);
      await tx.commit();
    } else {
      await tx.run(
        "MATCH (user:User {email:$email}) SET user.expoToken = $expoToken",
        {
          email: data.user.email,
          expoToken: expoToken
        }
      )
      await tx.commit();
      res.status(200).send({
        userId: user.records[0]._fields[0].properties.id,
        phoneVerificationReq:
          user.records[0]._fields[0].properties.phoneNumber === undefined
            ? true
            : false,
      });
    }
    await session.close();
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
}

async function auth(req, res) {
  let type = req.body.type;
  if (type === "google") {
    await loginWithGoogle(req, res);
  } else {
    await loginWithFacebook(req, res);
  }
}

async function addPhoneNumber(req, res) {
  try {
    const session = driver.session();
    let tx = session.beginTransaction();
    let promises = [];
    console.log('Hi!');
    console.log(req.body)
    console.log(req.body.phoneNumber)
    promises.push(
      tx.run("MATCH (user:User {id:$id}) SET user.phoneNumber=$phoneNumber", {
        id: req.body.userId,
        phoneNumber: req.body.phoneNumber,
      })
    );
    promises.push(
      tx.run(
        "MATCH (tag:TaggedNotOnApp {phoneNumber:$phoneNumber}) RETURN tag",
        {
          phoneNumber: req.body.phoneNumber,
        }
      )
    );
    let result = await Promise.all(promises);
    let tagged = result[1];
    console.log(JSON.stringify(result[0]));
    if (tagged.records.length > 0) {
      let taggedRelations = await tx.run(
        "MATCH (tag:TaggedNotOnApp {phoneNumber:$phoneNumber})-[r]-(node) RETURN tag,r,node",
        {
          phoneNumber: req.body.phoneNumber,
        }
      );
      let promises2 = [];
      taggedRelations.records.map(async (record) => {
        let tagId = record._fields[0].identity.low;
        let relation = record._fields[1].type;
        let relationProperties = record._fields[1].properties;
        let nodeId = record._fields[2].identity.low;
        if (record._fields[1].start.low === tagId) {
          promises2.push(
            tx.run(
              `MATCH (user:User {id:$userId}),(x) WHERE id(x)=${nodeId} \
                MERGE (x)<-[r:${relation} ${neo4jDriver.objToCypherString(
                relationProperties
              )}]-(user)`,
              {
                userId: req.body.userId,
                ...relationProperties,
              }
            )
          );
        } else {
          promises2.push(
            tx.run(
              `MATCH (user:User {id:$userId}),(x) WHERE id(x)=${nodeId} \
                MERGE (x)-[r:${relation} ${neo4jDriver.objToCypherString(
                relationProperties
              )}]->(user)`,
              {
                userId: req.body.userId,
                ...relationProperties,
              }
            )
          );
        }
      });
      await Promise.all(promises2);
      await tx.run(
        `MATCH (tag:TaggedNotOnApp {phoneNumber:$phoneNumber}) DETACH DELETE tag`,
        {
          phoneNumber: req.body.phoneNumber,
        }
      );
    }
    await tx.commit();
    await session.close();
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
}

async function participateInChallenge(req, res) {
  try {
    console.log("HI!");
    let data = req.body;
    const session = driver.session();
    let tx = session.beginTransaction();
    let promises = [];
    promises.push(
      tx.run(
        "MATCH (user:User {id:$userId}), (challenge:Challenge {id:$challengeId}) \
      MERGE (user)-[:participated {timestamp:$timestamp, attributed:$attributed}]->(challenge)",
        {
          userId: data.userId,
          challengeId: data.challengeId,
          timestamp: new Date().getTime().toString(),
          attributed: false,
        }
      )
    );
    promises.push(
      tx.run(
        `MATCH (user:User {id:$userId}), (challenge:Challenge {id:$challengeId}),  \
            (tagger:User)-[:tagged {challengeId:$challengeId}]->(user), \
           (tagger)-[r:participated {attributed:${false}}]->(challenge) \
            SET r.attributed=${true}`,
        {
          userId: data.userId,
          challengeId: data.challengeId,
        }
      )
    );
    await Promise.all(promises);
    await tx.commit();
    console.log("HI222!");
    let promises2 = [];
    let phoneNumbers = phoneNumbers.formatPhoneNumbers(data.invites);
    phoneNumbers.map((phoneNumber) => {
      promises2.push(tagUser(data.userId, data.challengeId, phoneNumber));
    });
    await Promise.all(promises2);
    console.log("HI333 !");
    // await tx.commit();
    await session.close();
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
}

async function tagUser(userId, challengeId, taggedPhoneNumber) {
  try {
    const session = driver.session();
    let tx = session.beginTransaction();
    let taggedUser = await tx.run(
      "MATCH (user:User {phoneNumber:$phoneNumber}) RETURN user",
      {
        phoneNumber: taggedPhoneNumber,
      }
    );
    if (taggedUser.records.length === 0) {
      await tx.run(
        "MERGE (tag:TaggedNotOnApp {phoneNumber:$phoneNumber}) \
        WITH tag \
        MATCH (user:User {id:$userId}) \
        MERGE (user)-[:tagged {challengeId:$challengeId}]->(tag) ",
        {
          phoneNumber: taggedPhoneNumber,
          userId: userId,
          challengeId: challengeId,
        }
      );
      await tx.commit();
    } else {
      let result = await tx.run(
        "MATCH (user:User {phoneNumber:$phoneNumber}),(challenge:Challenge {id:$challengeId}) \
      RETURN EXISTS((user)-[:participated]->(challenge))",
        {
          phoneNumber: taggedPhoneNumber,
          challengeId: challengeId,
        }
      );
      let alreadyParticipated = result.records[0]._fields[0];
      if (alreadyParticipated === true) {
        await tx.commit();
        return false;
      }
      await tx.run(
        "MATCH (user:User {id:$userId}),(tag:User {phoneNumber:$phoneNumber}) \
        WHERE user <> tag \
          MERGE (user)-[:tagged {challengeId:$challengeId}]->(tag) ",
        {
          phoneNumber: taggedPhoneNumber,
          userId: userId,
          challengeId: challengeId,
        }
      );
      await tx.commit();
    }
    await session.close();
    return true;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function getTaggingTree(userId, challengeId) {
  try {
    const session = driver.session();
    let tx = session.beginTransaction();
    // let result = await tx.run(
    //   "MATCH (c)<-[:tagged*1..]-(root:User {id:$id})\
    //     RETURN COLLECT(c) AS tree",
    //   {
    //     id: req.body.userId
    //   }
    // );
    let result = await tx.run(
      `MATCH p=(root:User {id:$userId})-[r:tagged*]->(n),\
      (challenge:Challenge {id:$challengeId}) WHERE (n)-[:participated ]->(challenge) \
      WITH n, LENGTH(p) AS depth \
      RETURN COLLECT([n.id,n.name,n.profilePicUrl,depth])`,
      {
        userId: userId,
        challengeId: challengeId,
      }
    );
    await tx.commit();
    await session.close();
    return result.records[0]._fields[0];
  } catch (err) {
    console.error(err);
  }
}

async function getDashboard(req, res) {
  try {
    const session = driver.session();
    let tx = session.beginTransaction();
    let promises = [];
    let responseObj = {};
    promises.push(
      tx.run("MATCH (user:User {id:$id}) RETURN user", {
        id: req.body.userId,
      })
    );
    promises.push(
      tx.run("MATCH (challenge:Challenge {live:$live}) RETURN challenge", {
        live: true,
      })
    );
    promises.push(
      tx.run(
        "MATCH (challenge:Challenge),(user:User {id:$userId}) \
            WHERE (user)-[:participated]->(challenge) \
            RETURN challenge",
        {
          userId: req.body.userId,
        }
      )
    );
    let [user, liveChallenges, doneChallenges] = await Promise.all(promises);
    responseObj["user"] = user.records[0]._fields[0].properties;
    responseObj["liveChallenges"] = {};
    liveChallenges.records.map((challenge) => {
      responseObj["liveChallenges"][challenge._fields[0].properties.id] =
        challenge._fields[0].properties;
    });
    responseObj["dashboard"] = {};
    let promises2 = [];
    doneChallenges.records.map((challenge) => {
      async function getChallengeStats(challenge) {
        let challengeId = challenge._fields[0].properties.id;
        let challengeProperties = challenge._fields[0].properties;
        let promises3 = [];
        promises3.push(
          tx.run(
            `MATCH (challenge:Challenge {id:$challengeId}),\
                    (user:User)-[:participated {attributed:${true}}]->(challenge)\
                    RETURN COUNT(DISTINCT user)`,
            {
              challengeId: challengeId,
            }
          )
        );
        promises3.push(
          tx.run(
            `MATCH (challenge:Challenge {id:$challengeId}),\
                      (user:User)-[:participated]->(challenge)\
                      RETURN COUNT(DISTINCT user)`,
            {
              challengeId: challengeId,
            }
          )
        );
        promises3.push(getTaggingTree(req.body.userId, challengeId));
        let [
          participantsAttributed,
          totalParticipants,
          taggingTree,
        ] = await Promise.all(promises3);
        responseObj["dashboard"][challengeId] = challengeProperties;
        responseObj["dashboard"][challengeId].amountRaised =
          Number(challengeProperties.donationPerUser) *
          Number(participantsAttributed.records[0]._fields[0].low);
        responseObj["dashboard"][challengeId].attemptsAttributed = Number(
          participantsAttributed.records[0]._fields[0].low
        );
        responseObj["dashboard"][challengeId].participants = Number(
          totalParticipants.records[0]._fields[0].low
        );
        responseObj["dashboard"][challengeId]["firstConnection"] = [];
        responseObj["dashboard"][challengeId]["secondConnection"] = [];
        responseObj["dashboard"][challengeId]["thirdConnection"] = [];
        console.log(taggingTree);
        let addedUsers = [];
        taggingTree.map((user, index) => {
          console.log("START-" + index);
          let depth = user[3].low;
          let userId = user[0];
          let profileObj = {
            userId: userId,
            name: user[1],
            profilePicUrl: user[2],
          };
          if (addedUsers.includes(userId)) {
            return null;
          }
          addedUsers.push(userId);
          if (depth == 1) {
            responseObj["dashboard"][challengeId]["firstConnection"].push(
              profileObj
            );
          } else if (depth == 2) {
            responseObj["dashboard"][challengeId]["secondConnection"].push(
              profileObj
            );
          } else if (depth == 3) {
            responseObj["dashboard"][challengeId]["thirdConnection"].push(
              profileObj
            );
          }
          console.log("END-" + index);
        });
      }
      promises2.push(getChallengeStats(challenge));
    });
    await Promise.all(promises2);
    await tx.commit();
    await session.close();
    res.status(200).send(responseObj);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
}

async function signOut(req, res) {
  let userId = req.body.userId;
  const session = driver.session();
  let tx = session.beginTransaction();
  await tx.run(
    "MATCH (user:User {id:$id}) REMOVE user.expoToken", {
    id: userId
  }
  );
  await tx.commit();
  await session.close();
  res.sendStatus(200);
}

async function getAllUsers(req, res) {
  const session = driver.session();
  let tx = session.beginTransaction();
  let users = await tx.run(
    "MATCH (user:User) RETURN COLLECT(user.name)"
  );
  await tx.commit();
  await session.close();
  res.status(200).send(users.records[0]._fields[0]);
}

module.exports = {
  loginWithGoogle,
  loginWithFacebook,
  addPhoneNumber,
  participateInChallenge,
  tagUser,
  getTaggingTree,
  getDashboard,
  auth,
  signOut,
  getAllUsers
};
