import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChatMessage } from '../models/chat-message.model';
import { AuthService } from './auth.service';

// One line of the streamed reply from POST /ai/chat
type ChatStreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

const GENERIC_ERROR = 'Sorry, something went wrong. Please try again.';

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {}

  getHistory() {

    return this.http.get<ChatMessage[]>(
      `${environment.apiUrl}/ai/history`
    );

  }

  // Sends a message and emits the assistant's reply piece by piece as it is written.
  // Errors carry a message that is safe to show to the user.
  // Uses fetch instead of HttpClient because HttpClient can't hand over a response
  // while it is still arriving; the token refresh below mirrors the auth interceptor.
  sendMessage(
    message: string,
    image: File | null
  ): Observable<string> {

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

    return new Observable<string>((subscriber) => {

      const controller = new AbortController();

      const post = (token: string | null) => fetch(`${environment.apiUrl}/ai/chat`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
        signal: controller.signal
      });

      (async () => {
        try {
          let response = await post(this.authService.getAccessToken());

          if (response.status === 401) {
            // access token expired: get a new one and try once more
            try {
              const refreshed = await firstValueFrom(this.authService.refreshAccessToken());
              response = await post(refreshed.access_token);
            } catch {
              this.authService.logout();
              this.router.navigate(['/login']);
              throw new Error('Your session has expired. Please log in again.');
            }
          }

          if (!response.ok || !response.body) {
            // errors raised before streaming starts (e.g. an invalid image) come back as normal JSON
            const body = await response.json().catch(() => null);
            throw new Error(typeof body?.detail === 'string' ? body.detail : GENERIC_ERROR);
          }

          // the reply arrives as one JSON event per line
          const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
          let buffer = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }
            buffer += value;
            let newline: number;
            while ((newline = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, newline).trim();
              buffer = buffer.slice(newline + 1);
              if (!line) {
                continue;
              }
              const event = JSON.parse(line) as ChatStreamEvent;
              if (event.type === 'chunk') {
                subscriber.next(event.text);
              } else if (event.type === 'error') {
                throw new Error(event.message);
              }
            }
          }

          subscriber.complete();
        } catch (error) {
          if (controller.signal.aborted) {
            return; // the caller unsubscribed
          }
          const message = error instanceof Error && error.message !== 'Failed to fetch'
            ? error.message
            : GENERIC_ERROR;
          subscriber.error(new Error(message));
        }
      })();

      return () => controller.abort();

    });

  }

}
