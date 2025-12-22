Lucy Video Edit
Edit videos with text prompts for controlled results

LucyEdit enables controlled video edits. Modify specific elements - like clothing changes and character replacements - with flawless motion consistency, preserving the rest of the scene. Available in pro for even higher quality results.

Typescript
import { readFileSync, writeFileSync } from "fs";
import { createDecartClient, models } from "@decartai/sdk";

const client = createDecartClient({
  apiKey: "--your-api-key--"
});

const videoBuffer = readFileSync("/path/to/input.mp4");
const videoBlob = new Blob([videoBuffer], { type: "video/mp4" });

const result = await client.queue.submitAndPoll({
  model: models.video("lucy-pro-v2v"),
  prompt: "Change their shirt to black and shiny leather",
  data: videoBlob,
  onStatusChange: (job) => console.log(`Status: ${job.status}`),
});

if (result.status === "completed") {
  const buffer = Buffer.from(await result.data.arrayBuffer());
  writeFileSync("output.mp4", buffer);
}

Available Endpoints

Video Generation
Create Job Lucy Pro V2V

Copy page

Submit async job: Edit video using Lucy Pro model.

POST
/
v1
/
jobs
/
lucy-pro-v2v

Try it
Authorizations
​
x-api-key
stringheaderrequired
Headers
​
x-api-key
stringrequired
API key for authentication

​
User-Agent
string | null
Body
multipart/form-data
​
prompt
stringrequired
Text prompt for the video editing

​
data
filerequired
Video file to process

​
seed
integer
Seed for the video generation

Required range: 0 <= x <= 4294967295
​
resolution
stringdefault:720p
Resolution of the video

Allowed value: "720p"
​
enhance_prompt
booleandefault:true
Whether to enhance the prompt

​
num_inference_steps
integerdefault:50
Number of inference steps

Response

200

application/json
Successful Response

cURL
curl --request POST \
  --url https://api.decart.ai/v1/jobs/lucy-pro-v2v \
  --header 'Content-Type: multipart/form-data' \
  --header 'x-api-key: <api-key>' \
  --form 'prompt=<string>' \
  --form data='@example-file' \
  --form seed=2147483647 \
  --form resolution=720p \
  --form enhance_prompt=true \
  --form num_inference_steps=50

  Javascript
  const form = new FormData();
form.append('prompt', '<string>');
form.append('data', '<string>');
form.append('seed', '2147483647');
form.append('resolution', '720p');
form.append('enhance_prompt', 'true');
form.append('num_inference_steps', '50');

const options = {method: 'POST', headers: {'x-api-key': '<api-key>'}};

options.body = form;

fetch('https://api.decart.ai/v1/jobs/lucy-pro-v2v', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));


python
import requests

url = "https://api.decart.ai/v1/jobs/lucy-pro-v2v"

files = { "data": ("example-file", open("example-file", "rb")) }
payload = {
    "prompt": "<string>",
    "seed": "2147483647",
    "resolution": "720p",
    "enhance_prompt": "true",
    "num_inference_steps": "50"
}
headers = {"x-api-key": "<api-key>"}

response = requests.post(url, data=payload, files=files, headers=headers)

print(response.text)


422
{
  "detail": [
    {
      "loc": [
        "<string>"
      ],
      "msg": "<string>",
      "type": "<string>"
    }
  ]
}

Request Parameters
Parameter
Type
Required
Description
prompt
string
Yes
Describe the changes you want to make to the video. Be specific about what elements to modify while preserving temporal consistency and motion.
data
File
Yes
The video you want to edit. Supports MP4, WebM, and QuickTime formats up to 300MB. Output video is limited to 5 seconds.
resolution
string
No
Output video resolution. Higher resolutions provide more detail but take longer to process. (default: 720p) (options: 720p)
