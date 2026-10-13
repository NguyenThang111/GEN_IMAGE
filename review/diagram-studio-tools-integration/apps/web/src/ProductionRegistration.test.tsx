import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Api } from './api';
import { ProductionRegistration, registrationTimeLabel, validStartTime } from './ProductionRegistration';

describe('Production registration time',()=>{
  it('requires strict 24-hour HH:mm',()=>{
    for(const value of ['00:00','08:00','23:59'])expect(validStartTime(value)).toBe(true);
    for(const value of ['','8:00','24:00','08:60'])expect(validStartTime(value)).toBe(false);
  });
  it('shows time and a clear legacy fallback',()=>{
    expect(registrationTimeLabel({isRegistered:true,plannedStartTime:'08:30'})).toBe('Bắt đầu 08:30');
    expect(registrationTimeLabel({isRegistered:true})).toBe('Chưa bổ sung giờ');
    expect(registrationTimeLabel({isRegistered:false})).toBe('');
  });
  it('starts with an empty required input and disabled registration',()=>{
    const html=renderToStaticMarkup(<ProductionRegistration api={{} as Api} userId="user" workDate="2026-09-14" canEdit reported={false} onSaved={async()=>{}}/>);
    expect(html).toContain('type="time"');expect(html).toContain('required=""');expect(html).toContain('value=""');
    expect(html).toContain('disabled=""');expect(html).toContain('Đăng ký làm');
  });
  it('does not expose editing controls for another member',()=>{
    const html=renderToStaticMarkup(<ProductionRegistration api={{} as Api} userId="other" workDate="2026-09-14" canEdit={false} reported={false} onSaved={async()=>{}}/>);
    expect(html).not.toContain('<input');expect(html).not.toContain('<button');
  });
});
