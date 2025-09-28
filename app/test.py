from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

model = "model"
client = OpenAI(
    api_key=os.getenv("RAGFLOW_API_KEY"),
    base_url=f"https://demo.ragflow.io/api/v1/chats_openai/test_2"
)

stream = True
reference = True

completion = client.chat.completions.create(
    model=model,
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Who are you?"},
        {"role": "assistant", "content": "I am an AI assistant named..."},
        {"role": "user", "content": "Can you tell me who is nghia"},
    ],
    stream=stream,
    extra_body={"reference": reference}
)

if stream:
    for chunk in completion:
        print(chunk)
        if reference and chunk.choices[0].finish_reason == "stop":
            print(f"Reference:\n{chunk.choices[0].delta.reference}")
            print(f"Final content:\n{chunk.choices[0].delta.final_content}")
else:
    print(completion.choices[0].message.content)
    if reference:
        print(completion.choices[0].message.reference)