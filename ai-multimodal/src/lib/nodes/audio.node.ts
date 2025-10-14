import { BlogGenerationStateType } from "../node-state";

export const generateAudioNode = async (state: BlogGenerationStateType): Promise<Partial<BlogGenerationStateType>> => {
  try {
    if (!state.summary) {
      return { error: "No summary to convert to audio" };
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'alloy',
        input: state.summary,
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS API failed: ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
    
    return { audioUrl };
  } catch (error) {
    console.error("Error in audio generation node:", error);
    return { 
      error: error instanceof Error ? error.message : "Failed to generate audio" 
    };
  }
};