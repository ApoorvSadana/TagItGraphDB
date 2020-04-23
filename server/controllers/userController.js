const { v4 } = require("uuid");
const driver = require("../models");
const neo4jDriver = require("../utils/neo4jDriver");

async function loginWithGoogle(req, res) {
  let data = req.body;

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
    if (user.records.length === 0) {
      let userId = v4();
      await tx.run(
        "CREATE (user:User {id:$id,name:$name,email:$email,profilePicUrl:$profilePicUrl}) \
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
        }
      );
      await tx.commit();
      res.status(200).send({ userId: userId, phoneVerificationReq: true });
    } else if (
      user.records.length !== 0 &&
      userWithGoogleAuth.records.length === 0
    ) {
      await tx.run(
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
      );
      await tx.commit();
    } else {
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
    if (user.records.length === 0) {
      let userId = v4();
      await tx.run(
        "CREATE (user:User {id:$id,name:$name,email:$email,profilePicUrl:$profilePicUrl}) \
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
        }
      );
      await tx.commit();
      res.status(200).send({ userId: userId, phoneVerificationReq: true });
    } else if (
      user.records.length !== 0 &&
      userWithFacebookAuth.records.length === 0
    ) {
      await tx.run(
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
      );
      await tx.commit();
    } else {
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

async function addPhoneNumber(req, res) {
  try {
    const session = driver.session();
    let tx = session.beginTransaction();
    let promises = [];
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
    let data = req.body;
    const session = driver.session();
    await session.run(
      "MATCH (user:User {id:$userId}), (challenge:Challenge {id:$challengeId}) \
      MERGE (user)-[:participated {timestamp:$timestamp}]->(challenge) ",
      {
        userId: data.userId,
        challengeId: data.challengeId,
        timestamp: new Date().getTime().toString(),
      }
    );
    let promises = [];
    data.invites.map((phoneNumber) => {
      promises.push(tagUser(data.userId, data.challengeId, phoneNumber));
    });
    await Promise.all(promises);
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
    return -1;
  }
}

async function getTaggingTree(req, res) {
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
      "MATCH p=(root:User {id:$userId})-[r:tagged*]->(n),\
      (challenge:Challenge {id:$challengeId}) WHERE (n)-[:participated]->(challenge) \
      WITH n, LENGTH(p) AS depth \
      RETURN COLLECT([n, depth])",
      {
        userId: req.body.userId,
        challengeId: req.body.challengeId,
      }
    );
    await tx.commit();
    await session.close();
    res.status(200).send(result.records[0]._fields);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
}

module.exports = {
  loginWithGoogle,
  loginWithFacebook,
  addPhoneNumber,
  participateInChallenge,
  tagUser,
  getTaggingTree,
};
