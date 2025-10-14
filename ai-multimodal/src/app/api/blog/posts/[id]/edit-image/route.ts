import { NextRequest, NextResponse } from "next/server";
import { dbManager } from "@/lib/database";
import { editImage } from "@/lib/nodes/image.node";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { sectionIndex, prompt } = body;

    if (typeof sectionIndex !== "number" || !prompt) {
      return NextResponse.json(
        { error: "Section index and prompt are required" },
        { status: 400 }
      );
    }

    const blogPost = await dbManager.getBlogPostById(id);
    
    const section = blogPost!.sections[sectionIndex];

    const base64Match = section.imageUrl!.match(/^data:image\/\w+;base64,(.+)$/);

    const base64Image = base64Match![1];

    const newImageUrl = await editImage(base64Image, prompt);

    const updatedSections = [...blogPost!.sections];
    updatedSections[sectionIndex] = {
      ...section,
      imageUrl: newImageUrl,
    };

    await dbManager.updateBlogPost(id, {
      sections: updatedSections,
    });

    return NextResponse.json({
      success: true,
      imageUrl: newImageUrl,
    });

  } catch (error) {
    console.error("Error editing image:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to edit image" },
      { status: 500 }
    );
  }
}

