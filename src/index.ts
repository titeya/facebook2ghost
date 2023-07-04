import express from "express";
import passport from "passport";
// import { promises as fsPromises } from "fs";
import { Strategy as FacebookStrategy } from "passport-facebook";
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
      function (accessToken, refreshToken, profile, done) {
        // Vous pourriez ici stocker l'accessToken dans une base de données avec le profile.id comme clé
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

  app.get(
    "/auth",
    passport.authenticate("facebook", {
      session: false,
      failureRedirect: "/login",
    }),
    async function (req: any, res) {
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
        #prog-cont {
            display: none;
        }
        #progress {
            font-size: 24px;
            color: #007BFF;
            margin-top: 10px;
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
    </style>
</head>
<body>
    <div class="container">
    <div id="prog-cont" >Avancement: <span id="progress">0%</span></div>
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
        const source = new EventSource('/download?token=${req.user.accessToken}&userId=${req.user.profile.id}');
        source.onmessage = function(event) {
          document.getElementById('progress').textContent = Math.round(event.data * 100) + '%';
          if (event.data === 'done') {
            source.close();
            document.getElementById('success').style.display = 'flex';
            document.getElementById('start').style.display = 'none';;
            document.getElementById('prog-cont').style.display = 'none';
            document.getElementById('download').style.display = 'block';
          } else {
            document.getElementById('progress').textContent = Math.round(event.data * 100) + '%';
          }
        };
      }
    </script>
    </body>
</html>
  `);
    }
  );

  app.get("/download", async function (req, res) {
    const { token, userId } = req.query;

    if (!token || !userId) {
      res.status(400).send("Missing token or userId");
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    await getFacebookPosts(
      token as string,
      userId as string,
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
  app.listen(3000, () => console.log("Application is running on port 3000"));
}
