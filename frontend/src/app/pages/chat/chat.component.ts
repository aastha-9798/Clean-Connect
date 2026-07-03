import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../core/services/chat.service';
import { ChatMessage } from '../../core/models/chat-message.model';
import { FormsModule } from '@angular/forms';
import { ElementRef, ViewChild } from '@angular/core';

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css'
})


export class ChatComponent implements OnInit {

  messages: ChatMessage[] = [];
  message = '';

  selectedImage: File | null = null;

  imagePreview: string | null = null;

  isLoading = false;
  @ViewChild('chatContainer')
  chatContainer!: ElementRef;
  @ViewChild('fileInput')
  fileInput!: ElementRef<HTMLInputElement>;

  constructor(
    private chatService: ChatService
  ) {}

  ngOnInit(): void {

    this.loadHistory();

  }

  loadHistory(): void {

    this.chatService.getHistory()
      .subscribe({

        next: (response) => {

          this.messages = response;

        },

        error: (error) => {

          console.error(error);

        }

      });

  }
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement; //event has many properties one of which is target
    // target is the element that triggered change. ( .files )
    if (!input.files || input.files.length === 0) {
      return;
    }
    this.selectedImage = input.files[0];
    const reader = new FileReader();
    reader.onload = () => { // onload:  when filereader finishes reading, execute this
      this.imagePreview = reader.result as string;
    };
    reader.readAsDataURL(this.selectedImage);

  }

  sendMessage(): void {
    const text = this.message.trim();
    if (!text) {
      return;
    }
    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      image: this.imagePreview
    };
    this.messages.push(userMessage);
    this.scrollToBottom();

    const image = this.selectedImage;
    this.message = '';
    this.selectedImage = null;
    this.imagePreview = null;
    this.isLoading = true;

    const thinkingMessage: ChatMessage = {
      role: 'assistant',
      content: 'Thinking...',
      image: null
    };
    this.messages.push(thinkingMessage);
    this.scrollToBottom();
    this.chatService
    .sendMessage(text, image)
    .subscribe({
      next: (response) => {

        this.messages.pop();
        this.messages.push({
          role: 'assistant',
          content: response.response,
          image: null
        });
        this.isLoading = false;

      },
      error: (error) => {
        console.error(error);
        this.messages.pop();
        this.messages.push({
            role: 'assistant',
            content: 'Sorry, something went wrong.',
            image: null
        });
        this.isLoading = false;
      }

    });
  }
  scrollToBottom(): void {

    setTimeout(() => {

      this.chatContainer.nativeElement.scrollTop =
        this.chatContainer.nativeElement.scrollHeight;

    });

  }
onEnter(event: Event): void {

  const keyboardEvent = event as KeyboardEvent;
  if (keyboardEvent.shiftKey) {
    return;
  }
  event.preventDefault();
  this.sendMessage();

}

  removeImage(): void {

    this.selectedImage = null;
    this.imagePreview = null;
    this.fileInput.nativeElement.value = '';

  }

}
