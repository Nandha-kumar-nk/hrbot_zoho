require("dotenv").config();

const express = require("express");
const cors = require("cors");
 // no longer used for OTP, can remove later
const { recruitGET, recruitPOST, recruitPUT } = require("./recruit");

// Twilio SDK
const twilio = require("twilio")(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

const app = express();
app.use(cors());
app.use(express.json());

console.log("------------------------------------------------");
console.log("BOT RESTARTED");
console.log("Twilio SID:", process.env.TWILIO_ACCOUNT_SID ? "Loaded" : "Missing");
console.log("------------------------------------------------");

const sessionStore = new Map();
const otpStore = new Map();

// SEND OTP VIA TWILIO SMS
async function sendOtpSms(toPhone, otp) {
    return twilio.messages.create({
        body: `Your verification code is: ${otp}`,
        from: process.env.TWILIO_FROM_NUMBER,
        to: toPhone
    });
}

function isValidEmail(email) {
    return /\S+@\S+\.\S+/.test(email);
}

function cleanText(text) {
    if (!text) return "";
    let clean = text.replace(/<[^>]*>?/gm, "");
    return clean.replace(/(\r\n|\n|\r)/gm, " ").trim();
}

// ROUTER

app.get(["/", "/zobot"], (req, res) => {
    res.send("HR Bot is Online.");
});

app.post("/zobot", async (req, res) => {
    try {
        const payload = req.body;
        const userId = payload.visitor ? payload.visitor.id : "unknown_user";

        let message = "";
        if (payload.message) {
            if (typeof payload.message === "object") {
                if (payload.message.text) message = payload.message.text;
                else if (payload.message.attachment) message = "FILE_UPLOAD";
            } else {
                message = payload.message.toString();
            }
        }
        message = message ? message.trim() : "";
        const lowerMsg = message.toLowerCase();

        let contextId = "";
        let contextParams = {};
        if (payload.context && payload.context.id) {
            contextId = payload.context.id;
            contextParams = payload.context.params || {};
        } else {
            const savedSession = sessionStore.get(userId);
            if (savedSession) {
                contextId = savedSession.id;
                contextParams = savedSession.params || {};
            }
        }

        console.log(`IN: "${message}" | CTX: "${contextId}"`);

        let response = {
            action: "reply",
            replies: [],
            suggestions: []
        };

        // SECTION A: GLOBAL COMMANDS

        if (lowerMsg === "restart" || lowerMsg === "hi" || lowerMsg === "hello") {
            sessionStore.delete(userId);
            response.replies = ["Hi! I am your HR Assistant. How can I help you?"];
            response.suggestions = ["Apply for Jobs", "Find a Job", "My Jobs"];
            return res.json(response);
        }

        if (lowerMsg === "apply for jobs" || lowerMsg === "jobs") {
            sessionStore.delete(userId);
            try {
                const data = await recruitGET("/JobOpenings");
                if (!data.data || data.data.length === 0) {
                    response.replies = ["Sorry, no open positions right now."];
                } else {
                    let jobMsg = "Here are the latest openings:\n";
                    let chips = [];
                    data.data.slice(0, 5).forEach((job, index) => {
                        let title = cleanText(
                            job.Job_Opening_Name || job.Posting_Title || "Job"
                        );
                        jobMsg += `\n**${index + 1}. ${title}**\n`;
                        chips.push(`Apply: ${job.id}`);
                        chips.push(`Details: ${job.id}`);
                    });
                    response.replies = [jobMsg];
                    response.suggestions = chips;
                }
            } catch (error) {
                response.replies = ["Error loading jobs."];
            }
            return res.json(response);
        }

        if (lowerMsg === "my jobs" || lowerMsg === "status") {
            sessionStore.delete(userId);
            response.replies = [
                "Please enter your Email Address to check your application status."
            ];
            const nextState = { id: "check_status", params: {} };
            response.context = nextState;
            sessionStore.set(userId, nextState);
            return res.json(response);
        }

        if (lowerMsg === "find a job" || lowerMsg === "search") {
            sessionStore.delete(userId);
            response.replies = ["What is your primary skill? (e.g., Java, Sales)"];
            const nextState = { id: "search_skill", params: {} };
            response.context = nextState;
            sessionStore.set(userId, nextState);
            return res.json(response);
        }

        // SECTION B: CONTEXT FLOWS

        if (contextId === "check_status") {
            const email = cleanText(message);
            try {
                const search = await recruitGET(
                    `/Candidates/search?criteria=(Email:equals:${email})`
                );
                if (!search.data) {
                    response.replies = ["I couldn't find an application with that email."];
                } else {
                    const cId = search.data[0].id;
                    const apps = await recruitGET(`/Candidates/${cId}/Applications`);
                    if (apps.data) {
                        let report = "Your Applications:\n";
                        apps.data.forEach(app => {
                            let jobName = app.Job_Opening_Name || "Job";
                            if (typeof jobName === "object" && jobName.name)
                                jobName = jobName.name;
                            report += `\n• ${jobName}\n   Status: ${app.Stage || "Applied"}\n`;
                        });
                        response.replies = [report];
                    } else {
                        response.replies = ["Profile found, but no active applications."];
                    }
                }
            } catch (e) {
                response.replies = ["Error fetching status."];
            }
            sessionStore.delete(userId);
            response.suggestions = ["My Jobs", "Apply for Jobs"];
            return res.json(response);
        }

        if (contextId === "search_skill") {
            const skill = message.toLowerCase();
            const data = await recruitGET("/JobOpenings");
            const matched = data.data.filter(
                j =>
                    (j.Required_Skills &&
                        j.Required_Skills.toLowerCase().includes(skill)) ||
                    (j.Job_Opening_Name &&
                        j.Job_Opening_Name.toLowerCase().includes(skill))
            );
            if (matched.length > 0) {
                let report = `Found ${matched.length} job(s):\n`;
                let chips = [];
                matched.slice(0, 5).forEach(job => {
                    let title = cleanText(job.Job_Opening_Name || job.Posting_Title);
                    report += `\n- ${title}\n`;
                    chips.push(`Apply: ${job.id}`);
                });
                response.replies = [report];
                response.suggestions = chips;
            } else {
                response.replies = [`No jobs found for "${message}".`];
                response.suggestions = ["Apply for Jobs"];
            }
            sessionStore.delete(userId);
            return res.json(response);
        }

        if (message.startsWith("Details: ") || message.startsWith("details_id::")) {
            const jobId = message.includes("::")
                ? message.split("::")[1]
                : message.split(": ")[1];
            try {
                const data = await recruitGET(`/JobOpenings/${jobId}`);
                if (data.data && data.data.length > 0) {
                    const job = data.data[0];
                    const title = cleanText(job.Job_Opening_Name || job.Posting_Title);
                    let desc = cleanText(job.Job_Description || "No description.");
                    if (desc.length > 400) desc = desc.substring(0, 400) + "...";
                    response.replies = [`**${title}**\n\n${desc}`];
                    response.suggestions = [`Apply: ${jobId}`];
                }
            } catch (e) {
                response.replies = ["Error loading details."];
            }
            return res.json(response);
        }

        // SECTION C: APPLY FLOW

        if (message.startsWith("Apply: ") || message.startsWith("apply_id::")) {
            const jobId = message.includes("::")
                ? message.split("::")[1]
                : message.split(": ")[1];
            response.replies = ["Let's start. What is your Full Name?"];
            const nextState = { id: "collect_name", params: { job_id: jobId } };
            response.context = nextState;
            sessionStore.set(userId, nextState);
            return res.json(response);
        }

        if (contextId === "collect_name") {
            contextParams.name = cleanText(message);
            response.replies = ["Thanks. What is your Email?"];
            const nextState = { id: "collect_email", params: contextParams };
            response.context = nextState;
            sessionStore.set(userId, nextState);
            return res.json(response);
        }

        // Step 3: Email -> ask for phone, send OTP via SMS
        if (contextId === "collect_email") {
            contextParams.email = cleanText(message);

            if (!isValidEmail(contextParams.email)) {
                response.replies = [
                    "That doesn't look like a valid email. Please try again."
                ];
                response.context = { id: "collect_email", params: contextParams };
                return res.json(response);
            }

            response.replies = [
                "Email saved. Please enter your Mobile Number (with country code, e.g., +919876543210)."
            ];
            const nextState = { id: "collect_phone_for_otp", params: contextParams };
            response.context = nextState;
            sessionStore.set(userId, nextState);
            return res.json(response);
        }

        // Step 3b: collect phone and send SMS OTP
        if (contextId === "collect_phone_for_otp") {
            contextParams.phone = cleanText(message);

            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            otpStore.set(contextParams.phone, otp);

            console.log(`Sending OTP SMS to ${contextParams.phone} (background)...`);
            sendOtpSms(contextParams.phone, otp).catch(err => {
                console.error("SMS send failed:", err.message);
            });

            response.replies = [
                "A verification code has been sent to your mobile number.",
                "Please enter the 6-digit OTP."
            ];

            const nextState = { id: "verify_otp_sms", params: contextParams };
            response.context = nextState;
            sessionStore.set(userId, nextState);
            return res.json(response);
        }

        // Step 4: Verify SMS OTP -> final phone confirm (we already have phone)
        if (contextId === "verify_otp_sms") {
            const enteredOtp = cleanText(message);
            const storedOtp = otpStore.get(contextParams.phone);

            if (storedOtp && enteredOtp === storedOtp) {
                otpStore.delete(contextParams.phone);
                response.replies = [
                    "Mobile number verified. Proceeding with your application."
                ];
                const nextState = { id: "collect_phone", params: contextParams };
                response.context = nextState;
                sessionStore.set(userId, nextState);
            } else {
                response.replies = [
                    "Incorrect OTP. Please check the code sent to your phone and try again."
                ];
                response.context = { id: "verify_otp_sms", params: contextParams };
            }
            return res.json(response);
        }

        // Step 5: Phone -> Submit (phone already in contextParams.phone)
        if (contextId === "collect_phone") {
            // Optionally allow user to confirm or edit phone here
            // contextParams.phone = cleanText(message);

            try {
                const nameParts = contextParams.name.split(" ");
                const candData = {
                    data: [
                        {
                            First_Name: nameParts[0],
                            Last_Name: nameParts.slice(1).join(" ") || "-",
                            Email: contextParams.email,
                            Mobile: contextParams.phone,
                            Source: "Chatbot"
                        }
                    ]
                };

                const cRes = await recruitPOST("/Candidates", candData);
                if (!cRes.data || !cRes.data[0].details)
                    throw new Error("Candidate Creation Failed");

                const cId = cRes.data[0].details.id;
                const jobId = contextParams.job_id;

                const assocPayload = {
                    data: [
                        {
                            ids: [cId],
                            jobids: [jobId],
                            status: "Applied",
                            comments: "Verified via SMS OTP"
                        }
                    ]
                };
                await recruitPUT("/Candidates/actions/associate", assocPayload);

                response.replies = ["Application Successful. Your profile has been created."];
                response.suggestions = ["My Jobs", "Find a Job"];
                sessionStore.delete(userId);
            } catch (e) {
                console.error("Zoho Error:", e);
                response.replies = [
                    "Saved your details, but failed to link the job."
                ];
                sessionStore.delete(userId);
            }
            return res.json(response);
        }

        console.log("Fallback:", message);
        response.replies = ["I did not quite catch that. Please select an option:"];
        response.suggestions = ["Apply for Jobs", "Find a Job", "My Jobs"];
        return res.json(response);
    } catch (error) {
        console.error("SYSTEM ERROR:", error);
        res.json({ replies: ["System Error."] });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Bot Server running on ${PORT}`);
});
