import {
  BehaviorSubject, concatAll, distinctUntilChanged, from, interval, map, Observable, of,
  queueScheduler, scan, scheduled, SchedulerLike, shareReplay, skip, switchMap, take, zip
} from 'rxjs';

import { Component } from '@angular/core';
import { IonItemSliding, RefresherCustomEvent } from '@ionic/angular';

import { DataService, Message, MessageGroup } from '../services/data.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {

  groups$: Observable<MessageGroup[]>;
  timedGroups$: Observable<MessageGroup[]>;

  constructor(private data: DataService) {

    const groups: MessageGroup[] = [];
    for (let i = 0; i < 10; i++) {
      groups.push({
        name: `Group ${i}`,
        messages: this.data.getMessages(Math.random() * 10),
      });
    }
    this.groups$ = new BehaviorSubject<MessageGroup[]>(groups)

    this.timedGroups$ = of(1).pipe(switchMap(() => {
      let loading = true;
      return this.groups$
        .pipe(switchMap((groups) => {
          const intervalMs = groups[0]?.messages?.length > 15 ? 500 : 250;
          const stagger$ = of(groups);
          if (loading) {
            loading = false;
            return staggerArray(stagger$, intervalMs);
          } else {
            loading = false;
            return stagger$;
          }
        }));
    })).pipe(shareReplay({ refCount: true, bufferSize: 1 }));
  }

  openSlider(slider: IonItemSliding) {
    slider.open('end');
  }

  refresh(ev: any) {
    setTimeout(() => {
      (ev as RefresherCustomEvent).detail.complete();
    }, 3000);
  }

  getMessages(): Message[] {
    return this.data.getMessages();
  }

  trackGroupByName(_index: number, group: MessageGroup) {
    return group.name;
  }

  trackMessageById(_index: number, message: Message) {
    return message.id;
  }

}

export function staggerArray<T>(obs: Observable<T[]>, delay: number = 0, opts: {
  leading?: boolean,
  scheduler?: SchedulerLike
} = {}) {
  const events$ = obs.pipe(
    switchMap(
      val => delay
        ? zip(from(val), interval(delay)).pipe(map(([s]) => s))
        : zip(from(val)).pipe(map(([s]) => s))
    )
  ).pipe(
    scan((a, c) => [...a, c], [] as T[]),
    distinctUntilChanged()
  );

  if (!delay) {
    return events$;
  } else {
    const leading = opts?.leading ? [of([])] : [];
    const first = events$.pipe(take(1));
    const remaining = zip(events$.pipe(skip(1)), interval(delay)).pipe(map(([s]) => s));
    return scheduled([...leading, first, remaining], opts.scheduler ?? queueScheduler).pipe(concatAll());
  }
}
