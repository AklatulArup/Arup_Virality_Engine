import { redirect } from "next/navigation";

// The calibration page became the Trust Center. Bookmarks survive.
export default function CalibrationRedirect() {
  redirect("/trust");
}
