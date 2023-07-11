import express from "express";
import passport from "passport";
// import { promises as fsPromises } from "fs";
import { Strategy as FacebookStrategy } from "passport-facebook";
import axios from "axios";
import { writeFile, readFile } from "fs/promises";
import { getFacebookPosts } from "./importFbPost";
import dotenv from "dotenv";
// import e from "express";
dotenv.config();

const app = express();
app.use(passport.initialize());

const appID: string | undefined = process.env.FACEBOOK_APP_ID;
const appSecret: string | undefined = process.env.FACEBOOK_APP_SECRET;
const appURL: string | undefined = process.env.APP_URL;
const authorId: number = Number(process.env.AUTHOR_ID) || 1;

async function writeAccessTokenToFile(accessToken: string, profileId: string) {
  const data = {
    accessToken,
    profileId,
  };
  await writeFile("data.json", JSON.stringify(data));
}

async function readAccessTokenFromFile() {
  const data = JSON.parse(await readFile("data.json", "utf-8"));
  return data;
}

if (!appID || !appSecret || !appURL) {
  throw new Error("Missing environment variables");
} else {
  passport.use(
    new FacebookStrategy(
      {
        clientID: appID,
        clientSecret: appSecret,
        callbackURL: appURL + "/auth",
        profileFields: ["id", "displayName", "photos", "email"],
      },
      async function (accessToken, refreshToken, profile, done) {
        // Vous pourriez ici stocker l'accessToken dans une base de données avec le profile.id comme clé
        try {
          const response = await axios.get(
            `https://graph.facebook.com/v13.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${accessToken}`
          );
          const longLivedAccessToken = response.data.access_token;
          await writeAccessTokenToFile(longLivedAccessToken, profile.id);
          done(null, { accessToken: longLivedAccessToken, profile });
        } catch (error) {
          done(error);
        }
        done(null, { accessToken, profile });
      }
    )
  );

  app.get(
    "/",
    passport.authenticate("facebook", {
      session: false,
      scope: ["user_photos", "user_videos", "user_posts", "public_profile"],
    })
  );

  app.get("/start", async function (req, res) {
    res.send(`
    <!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background-color: #f0f0f0;
        }
        #prog-cont {
            display: none;
        }

        #start {
            display: inline-block;
            color: #fff;
            background-color: #007BFF;
            border: none;
            padding: 10px 20px;
            margin-top: 20px;
            cursor: pointer;
            text-decoration: none;
            
        }
        #download {
            display: none;
            color: #fff;
            background-color: #28a745;
            padding: 10px 20px;
            margin-top: 20px;
            text-decoration: none;
            text-align: center;
        }
        #success {
          flex-direction: column;
          align-items: center;
          display: none;
        }
        .progress-bar {
          width: 200px;
          height: 20px;
          background: #ffffff;
          border-radius: 5px;
          margin-top: 20px;
          margin-bottom: 8px;
          overflow: hidden;
          position: relative;
        }
        
        .filler {
          height: 100%;
          background: #7ca6fb;
          transition: width .150s;
          width: 0%;
          position: absolute;
          top: 0;
          left: 0;
        }
        #progress {
          font-size: 13px;
          color: #000000;
          width: 100%;
          height: 100%;
          position: absolute;
          text-align: center;
          line-height: 20px;
      }
    </style>
</head>
<body>
    <div class="container">
    <div id="prog-cont" >
    <div class="progress-bar">
    <div class="filler"></div>
    <div id="progress">0%</div>
    </div>
  </div>
    <button id="start" onclick="download()">Démarrer le traitement</button>
    <div id="success">
      <img src="https://media.giphy.com/media/2ieYd6DY1iS8y4arB2/giphy.gif" alt="success" />
      Traitement terminé !
    </div>
    <a id="download" href="/get-download" style="display: none" >Télécharger</a>
    </div>
    <script>
      function download() {
        document.getElementById('prog-cont').style.display = 'block';
        const source = new EventSource('/download');
        source.onmessage = function(event) {
          document.getElementById('progress').textContent = Math.round(event.data * 100) + '%';
          document.querySelector('.filler').style.width = Math.round(event.data * 100) + '%';
          if (event.data === 'done') {
            source.close();
            document.getElementById('success').style.display = 'flex';
            document.getElementById('start').style.display = 'none';;
            document.getElementById('prog-cont').style.display = 'none';
            document.getElementById('download').style.display = 'block';
          } else {
            document.getElementById('progress').textContent = Math.round(event.data * 100) + '%';
            document.querySelector('.filler').style.width = Math.round(event.data * 100) + '%';
          }
        };
      }
    </script>
    </body>
</html>
  `);
  });

  app.get(
    "/auth",
    passport.authenticate("facebook", {
      session: false,
      failureRedirect: "/login",
    }),
    async function (req: any, res, next) {
      try {
        // En cas de succès, redirigez vers l'accueil avec le token
        res.send(`
        <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                background-color: #f0f0f0;
            }
        </style>
    </head>
    <body>
        <div class="container">
        Authentification réussie !<br />
        <span style="font-size:13px;font-style: oblique;">Redirection en cours...</span>
        <script>
       
         setTimeout(function() {
         window.location.href = "/start";
         }, 400);
        </script>
        </div>
        </body>
    </html>
      `);
      } catch (error) {
        next(error);
      }
    }
  );

  app.get("/download", async function (req, res) {
    const { accessToken, profileId } = await readAccessTokenFromFile();
    console.log(accessToken, profileId);

    if (!accessToken || !profileId) {
      res.status(400).send("Missing token or userId");
      return;
    }
    try {
      const response = await axios.get(
        `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`
      );
      const data = response.data.data;
      const expiryDate = new Date(data.expires_at * 1000); // convertir de timestamp Unix en objet Date JavaScript
      console.log("Le token expire à : ", expiryDate);
    } catch (error) {
      console.error(
        "Une erreur s'est produite lors de la vérification de la date d'expiration du token : ",
        error
      );
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    await getFacebookPosts(
      accessToken as string,
      profileId as string,
      authorId,
      (progress) => {
        res.write(`data: ${progress}\n\n`);
      }
    );
    res.write("data: done\n\n");
    res.end();
  });

  app.get("/get-download", (req, res) => {
    res.download("export/export.zip", async (err) => {
      if (err) {
        console.error(err);
      } else {
        // Delete the images directory and its contents after the file has been downloaded
        // try {
        //   await fsPromises.rm("export", { recursive: true });
        //   console.log("export directory has been deleted");
        // } catch (err) {
        //   console.error("Failed to delete directory:", err);
        // }
        res.end();
      }
    });
  });

  app.use(
    (
      err: any,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      // gérer l'erreur ici, par exemple en envoyant une réponse avec un code d'erreur
      console.error(err.stack); // log l'erreur
      res.status(500).send("Une erreur s'est produite lors de la connexion.");
    }
  );

  app.listen(3000, () => console.log("Application is running on port 3000"));
}
