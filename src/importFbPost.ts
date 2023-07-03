import axios, { AxiosResponse } from "axios";
import https from "https";
import fs, { createWriteStream } from "fs";
import { promisify } from "util";
import path from "path";
import archiver from "archiver";

// import readline from "readline";

interface FacebookPost {
  message: string;
  attachments?: {
    data: {
      subattachments?: {
        data: {
          media: {
            image: {
              src: string;
            };
          };
        }[];
      };
      target: {
        id: string;
      };
      type: string;
    }[];
  };
  created_time: string;
  id: string;
}

const downloadImage = (url: string, dest: string) =>
  new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    https
      .get(url, (response) => {
        response.pipe(file);

        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", async (error) => {
        await promisify(fs.unlink)(dest);
        reject(error.message);
      });
  });

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

async function getAllFacebookPosts(
  accessToken: string,
  userId: string
): Promise<FacebookPost[]> {
  let url = `https://graph.facebook.com/${userId}/posts?fields=message,attachments{media,target,type,subattachments{media}},created_time&access_token=${accessToken}&limit=100`;
  let allPosts: FacebookPost[] = [];

  while (url) {
    const response: AxiosResponse = await axios.get(url);
    const posts: FacebookPost[] = response.data.data;
    allPosts = allPosts.concat(posts);

    // Get the URL for the next page of posts, or null if this is the last page
    url = response.data.paging?.next || null;
  }

  return allPosts;
}

export async function getFacebookPosts(
  accessToken: string,
  userId: string,
  progressCallback: (progress: number) => void
): Promise<void> {
  try {
    await mkdir("export", { recursive: true });
    const posts = await getAllFacebookPosts(accessToken, userId);

    // Filter posts to keep only album posts
    const albumPosts = posts.filter(
      (post) =>
        post.attachments &&
        post.attachments.data.some((attachment) => attachment.type === "album")
    );

    for (const post of albumPosts) {
      if (post.attachments) {
        for (const attachment of post.attachments.data) {
          if (attachment.type === "album") {
            // Get the images from the album
            const images =
              attachment.subattachments?.data.map(
                (subattachment) => subattachment.media.image.src
              ) || [];

            // Download the images and add them to the post
            const dir = path.join("export", "images", post.id);
            await mkdir(dir, { recursive: true });

            for (const [index, image] of images.entries()) {
              const filename = `${index}.jpg`;
              const dest = path.join(dir, filename);
              await downloadImage(image, dest);
            }
          }
        }
      }
      progressCallback(albumPosts.indexOf(post) / albumPosts.length);
    }
    const ghostPosts = albumPosts.map((post) => {
      const date = new Date(post.created_time);
      const timestamp = date.getTime();

      // Get the first line of the message
      const endOfFirstLine = post.message.indexOf("\n");
      const title =
        endOfFirstLine !== -1
          ? post.message.slice(0, endOfFirstLine)
          : post.message;

      // Get the images
      const images =
        post.attachments?.data.flatMap(
          (attachment) =>
            attachment.subattachments?.data.map(
              (subattachment, index) =>
                `/content/images/${post.id}/${index}.jpg`
            ) || []
        ) || [];
      const feature_image = images[0];
      const gallery = images.slice(1);

      return {
        title: title,
        slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        mobiledoc: JSON.stringify({
          version: "0.3.1",
          atoms: [],
          cards: gallery.map((src) => ["image", { src }]),
          markups: [],
          sections: [[1, "p", [[0, [], 0, post.message]]]],
        }),
        feature_image: feature_image,
        status: "published",
        created_at: timestamp,
        updated_at: timestamp,
        published_at: timestamp,
        custom_excerpt: "",
        tags: [],
        author_id: "5bfd4421da4e9d0001371db3",
      };
    });

    const ghostData = {
      db: [
        {
          data: {
            posts: ghostPosts,
          },
        },
      ],
    };

    // Write posts to JSON file
    await writeFile(
      "export/ghost-import.json",
      JSON.stringify(ghostData, null, 2)
    );

    // Create a file to stream archive data to.
    const output = createWriteStream("export/export.zip");
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Sets the compression level.
    });

    // Listen for all archive data to be written
    output.on("close", function () {
      console.log(archive.pointer() + " total bytes");
      console.log(
        "Archiver has been finalized and the output file descriptor has closed."
      );
    });

    // Good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on("warning", function (err) {
      if (err.code === "ENOENT") {
        console.warn(err);
      } else {
        // Throw error
        throw err;
      }
    });

    // Good practice to catch this error explicitly
    archive.on("error", function (err) {
      throw err;
    });

    // Pipe archive data to the file
    archive.pipe(output);

    // Append files
    archive.file("export/ghost-import.json", { name: "ghost-import.json" });
    archive.directory("export/images/", "images");

    await archive.finalize();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(
          `Error ${error.response.status}: ${error.response.data.error.message}`
        );
      } else if (error.request) {
        console.error("No response received from Facebook API.");
      } else {
        console.error("Error", error.message);
      }
    } else {
      console.error(error);
    }
  }
}

// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout,
// });

// rl.question(
//   "Veuillez entrer votre token d'accès Facebook : ",
//   (accessToken) => {
//     rl.question(
//       "Veuillez entrer votre ID utilisateur Facebook : ",
//       (userId) => {
//         getFacebookPosts(accessToken, userId)
//           .then(() => {
//             console.log("Done");
//             rl.close();
//           })
//           .catch((error) => {
//             console.error(error);
//             rl.close();
//           });
//       }
//     );
//   }
// );
