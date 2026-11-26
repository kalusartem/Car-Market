import { connect } from "cloudflare:sockets";
import { workersSmtpConnect, type Ctx } from "../_lib";
import { sendContact } from "../_contact";

const smtpConnect = workersSmtpConnect(connect);

export const onRequestPost = ({ request, env }: Ctx) => sendContact(request, env, smtpConnect);
