import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ChatMessage } from '../models/chat-message.model';

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  constructor(
    private http: HttpClient
  ) {}

  getHistory() {

    return this.http.get<ChatMessage[]>(
      `${environment.apiUrl}/ai/history`
    );

  }
  sendMessage(
    message: string,
    image: File | null
  ) {

    const formData = new FormData();

    formData.append(
      'message',
      message
    );

    if (image) {

      formData.append(
        'image',
        image
      );

    }

    return this.http.post<{
      response: string;
    }>(
      `${environment.apiUrl}/ai/chat`,
      formData
    );

  }

}
