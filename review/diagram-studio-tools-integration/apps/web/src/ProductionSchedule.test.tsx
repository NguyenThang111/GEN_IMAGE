import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe,it,expect } from 'vitest';
import { ProductionSchedule,productionTeam } from './ProductionSchedule';
import { AvatarContent,MemberAvatarProvider } from './MemberAvatars';
import type { Api,User,ProductionWorkSession } from './api';

describe('Production teams, warnings and avatars',()=>{
  const people=[{id:'1',username:'thanhbk',displayName:'THANH BK'},{id:'2',username:'phongbk',displayName:'PHONG BK'},{id:'3',username:'quangbk',displayName:'QUANG BK'}] as User[];
  it('groups Thanh/Phong into Hàn mạch and other production members into CÁP',()=>{expect(people.map(productionTeam)).toEqual(['SOLDER','SOLDER','CABLE']);});
  it('places MINH BK in Hàn mạch with a schedule row',()=>{
    const minh={id:'minh',username:'minhbk',displayName:'MINH BK'} as User;
    expect(productionTeam(minh)).toBe('SOLDER');
    const html=renderToStaticMarkup(<ProductionSchedule people={[minh]} dates={['2026-09-15']} sessions={[]} entries={[]} dayLabel={d=>d} onOpen={()=>{}}/>);
    expect(html).toContain('HÀN MẠCH');expect(html).toContain('aria-label="MINH BK 2026-09-15"');expect(html).not.toContain('LÀM CÁP');
  });
  it('renders two distinct team headings and the server payment warning',()=>{
    const sessions=[{userId:'1',workDate:'2026-09-14',isRegistered:true,hoursWorked:'4.00',plannedStartTime:null,registrationTimeMissing:true}] as ProductionWorkSession[];
    const html=renderToStaticMarkup(<ProductionSchedule people={people} dates={['2026-09-14']} sessions={sessions} entries={[]} dayLabel={d=>d} onOpen={()=>{}}/>);
    expect(html).toContain('HÀN MẠCH');expect(html).toContain('LÀM CÁP');expect(html).toContain('Chưa tính công');expect(html).toContain('missingStartTime');
  });
  it('shows LocBK in both teams on a single schedule row with shared hours',()=>{
    const loc={id:'loc',username:'LocBK',displayName:'LỘC BK'} as User;
    expect(productionTeam(loc)).toBe('BOTH');
    const dates=['2026-10-07','2026-10-08'];
    const sessions=[{userId:'loc',workDate:dates[0],isRegistered:true,hoursWorked:'4.00',plannedStartTime:'13:00'}] as ProductionWorkSession[];
    const entries=[{userId:'loc',workDate:dates[0],workType:'Báo cáo theo Worklog'}] as never;
    const html=renderToStaticMarkup(<ProductionSchedule people={[...people,loc]} dates={dates} sessions={sessions} entries={entries} dayLabel={d=>d} onOpen={()=>{}}/>);
    expect(html).toContain('Hàn mạch · Làm cáp');
    for(const date of dates)expect(html.split(`aria-label="LỘC BK ${date}"`)).toHaveLength(2);
    expect(html.match(/4h/g)).toHaveLength(1);
  });
  it('shares member image by ID while retaining initials for missing images',()=>{
    const html=renderToStaticMarkup(<MemberAvatarProvider api={{} as Api} people={[{...people[0],avatarDataUrl:'data:image/webp;base64,dGVzdA=='}]}><AvatarContent userId="1" name="THANH BK"/><AvatarContent userId="2" name="PHONG BK"/></MemberAvatarProvider>);
    expect(html).toContain('memberAvatarImage');expect(html).toContain('alt="THANH BK"');expect(html).toMatch(/\/>P$/);
  });
});
