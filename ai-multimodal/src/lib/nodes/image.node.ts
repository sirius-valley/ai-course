import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from "@google/genai";
import {
  BlogGenerationStateType,
  ImageGenerationStateType,
} from "../node-state";
import { BlogPost } from "./blog-content.node";
import Replicate from "replicate";

export const googleImageGenerationNode = async (
  state: ImageGenerationStateType
): Promise<Partial<ImageGenerationStateType>> => {
  const ai = new GoogleGenAI({});

  if (!state.imageCaption) {
    console.error(`No caption for section ${state.sectionIndex}`);
    return {};
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: `Generate an image for the following blogpost section:
       General blog title: ${state.topic}
       Image Caption: ${state.imageCaption}`,
      config: {
        // safetySettings: [
        //   {
        //     category: HarmCategory.HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT,
        //     threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        //   },
        // ],
        seed: 42,
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });

    if (!response.candidates?.[0]?.content?.parts) {
      console.error(
        `✗ No image generated for section ${state.sectionIndex + 1}`
      );
      return {};
    }

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const imageData = part.inlineData.data;
        const base64Image = `data:image/png;base64,${imageData}`;

        console.log(`✓ Generated image for section ${state.sectionIndex + 1}`);

        return {
          generatedImages: [
            {
              sectionIndex: state.sectionIndex,
              imageUrl: base64Image,
            },
          ],
        };
      }
    }

    console.log(
      "failed image parts",
      JSON.stringify(response.candidates[0].content.parts, null, 2)
    );

    console.error(
      `✗ Failed to generate image for section ${state.sectionIndex + 1}`
    );
    return {};
  } catch (error) {
    console.error(
      `Error generating image for section ${state.sectionIndex + 1}:`,
      error
    );
    return {};
  }
};

export const collectImagesNode = async (
  state: BlogGenerationStateType
): Promise<Partial<BlogGenerationStateType>> => {
  if (
    !state.blogPost ||
    !state.generatedImages ||
    state.generatedImages.length === 0
  ) {
    console.log("No images were generated");
    return {};
  }

  console.log(
    `\nCollecting ${state.generatedImages.length} generated images...`
  );

  const updatedSections = [...state.blogPost.sections];

  state.generatedImages.forEach(({ sectionIndex, imageUrl }) => {
    if (updatedSections[sectionIndex]) {
      updatedSections[sectionIndex] = {
        ...updatedSections[sectionIndex],
        imageUrl,
      };
    }
  });

  const updatedBlogPost: BlogPost = {
    ...state.blogPost,
    sections: updatedSections,
  };

  console.log("All images collected and integrated into blog post\n");

  return { blogPost: updatedBlogPost };
};

export const tencentImageGenerationNode = async (
  state: ImageGenerationStateType
): Promise<Partial<ImageGenerationStateType>> => {
  const replicate = new Replicate();

  const input = {
    prompt: `Generate an image for the following blogpost section:
       General blog title: ${state.topic}
       Image Caption: ${state.imageCaption}`,
    aspect_ratio: "16:9",
    // seed: 42,
    // output_quality: 95,
    // go_fast: true,
    // disable_safety_checker: false,
  };

  const output = await replicate.run("tencent/hunyuan-image-3", { input });

  const image = await fetch((output as unknown as { url: () => string }[])[0]?.url());
  const imageBuffer = await image.arrayBuffer();
  const base64Image = Buffer.from(imageBuffer).toString("base64");
  const imageUrl = `data:image/png;base64,${base64Image}`;

  return {
    generatedImages: [
      {
        sectionIndex: state.sectionIndex,
        imageUrl,
      },
    ],
  };
};

export const editImage = async (
  base64Image: string,
  prompt: string
): Promise<string> => {
  const promptContents = [
    {
      text: prompt,
    },
    {
      inlineData: {
        mimeType: "image/png",
        data: base64Image,
      },
    },
  ];
  const ai = new GoogleGenAI({});

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: promptContents,
    config: {
      // safetySettings: [
      //   {
      //     category: HarmCategory.HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT,
      //     threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
      //   },
      // ],
      // seed: 42,
      imageConfig: {
        aspectRatio: "16:9",
      },
    },
  });

  if (!response.candidates?.[0]?.content?.parts) {
    console.error(`Cannot generate new image with prompt: ${prompt}`);
    return base64Image;
  }

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const imageData = part.inlineData.data;
      const newBase64Image = `data:image/png;base64,${imageData}`;
      return newBase64Image;
    }
  }

  return base64Image;
};
