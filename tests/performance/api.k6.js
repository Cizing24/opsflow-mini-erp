import http from "k6/http";
import { check } from "k6";
export const options = {
  vus: Number(__ENV.VUS || 4),
  duration: "15s",
  thresholds: { http_req_failed: ["rate<0.01"] },
};
export function setup() {
  const r = http.post(
    `${__ENV.BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: "admin@opsflow.test",
      password: __ENV.DEMO_PASSWORD,
    }),
    {
      headers: { "Content-Type": "application/json", Origin: __ENV.APP_ORIGIN },
    },
  );
  check(r, { "login created": r.status === 201 });
  return { cookie: r.headers["Set-Cookie"].split(";")[0] };
}
export default function (data) {
  const r = http.get(`${__ENV.BASE_URL}/api/movements?pageSize=20`, {
    headers: { Cookie: data.cookie },
  });
  check(r, { "HTTP 200": r.status === 200 });
}
