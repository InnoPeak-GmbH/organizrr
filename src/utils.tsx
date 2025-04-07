import { IconCheck, IconExclamationMark } from "@tabler/icons-react";

import { CreateArchiveInput } from "./types";
import { notifications } from "@mantine/notifications";
import { ChatCompletionMessageParam } from "@mlc-ai/web-llm";

export const createArchiveAndDownload = async (
  getPayload: () => Promise<CreateArchiveInput>
) => {
  const id = Math.random().toString(36).replace("0.", "notification_");

  notifications.show({
    id,
    title: "Dateien werden verarbeitet",
    message: "Dateien werden nun benennt und als ZIP gespeichert",
    autoClose: false,
    withCloseButton: false,
    loading: true,
  });

  const payload = await getPayload();

  try {
    const resultArchive = await createArchive(JSON.stringify(payload));

    notifications.update({
      id,
      color: "teal",
      title: "Dateien wurden verarbeitet",
      message: `Dateien können nun heruntergeladen werden!`,
      icon: <IconCheck size={18} />,
      loading: false,
      autoClose: 2000,
    });

    const uri = `data:application/zip;base64,${resultArchive}`;

    const date = `${new Date().getFullYear()}-${new Date()
      .getMonth()
      .toString()
      .padStart(2, "0")}-${new Date()
      .getDate()
      .toString()
      .padStart(2, "0")}_${new Date()
      .getHours()
      .toString()
      .padStart(2, "0")}-${new Date()
      .getMinutes()
      .toString()
      .padStart(2, "0")}-${new Date()
      .getSeconds()
      .toString()
      .padStart(2, "0")}`;

    const link = document.createElement("a");
    link.download = `${date}_${payload.customer.firstName}_${payload.customer.lastName}`;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error: unknown) {
    notifications.update({
      id,
      color: "red",
      title: "Ein Fehler ist passiert",
      message: String(error),
      icon: <IconExclamationMark size={18} />,
      loading: false,
      autoClose: 2000,
    });

    console.error(error);

    return;
  }
};

export const getFileDataUrl = (file: File) => {
  const reader = new FileReader();

  const promise = new Promise<string>((res, rej) => {
    reader.onload = () => {
      res((reader.result as string)?.split(",")[1]);
    };

    reader.onerror = () => {
      rej();
    };
  });

  reader.readAsDataURL(file);

  return promise;
};

export const fileCategories = [
  "Lohnausweis",
  "Öffentlicher Verkehr",
  "Steuererklärung",
  "Weiterbildung",
  "3A Bescheinigung",
  "Steuerzugangsdaten",
  "Wertschriften",
  "Kontoauszug",
  "Zinsauweis",
  "Krankenkassenprämie",
  "Krankenkassenrechnung",
];

export const systemMessage = {
  role: "system",
  content: `
You are an AI assistant for a financial advisor. You will help them label files based on the file name using the following categories: ${fileCategories.join(
    ", "
  )}

The user will provide the file name. Make the best assumption based on common financial document names. Respond ONLY with the label or "Unable to label file" - nothing else.
`,
} satisfies ChatCompletionMessageParam;
