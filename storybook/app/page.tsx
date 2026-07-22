import { redirect } from "next/navigation";

// Einstieg -> geschütztes Storybook. Die Middleware erzwingt vorher den Login.
export default function Home() {
  redirect("/sb/");
}
