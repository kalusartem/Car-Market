import { connect } from "cloudflare:sockets";
import { workersSmtpConnect, type Ctx } from "../../_lib";
import { notifyListingReview } from "../../_notify";

const smtpConnect = workersSmtpConnect(connect);

export const onRequestPost = ({ request, env }: Ctx) => notifyListingReview(request, env, smtpConnect);
