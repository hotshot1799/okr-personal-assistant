# converse.py
import sys
from transformers import AutoModelForCausalLM, AutoTokenizer

# Load pre-trained DialoGPT
tokenizer = AutoTokenizer.from_pretrained("microsoft/DialoGPT-medium")
model = AutoModelForCausalLM.from_pretrained("microsoft/DialoGPT-medium")

# User input (from Node.js API)
user_input = sys.argv[1]

# Tokenize the input and generate a response
input_ids = tokenizer.encode(user_input + tokenizer.eos_token, return_tensors='pt')
chat_history_ids = model.generate(input_ids, max_length=1000, pad_token_id=tokenizer.eos_token_id)

# Decode the response
response = tokenizer.decode(chat_history_ids[:, input_ids.shape[-1]:][0], skip_special_tokens=True)

# Print the response to send back to Node.js
print(response)